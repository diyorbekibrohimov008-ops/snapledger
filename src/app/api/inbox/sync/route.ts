import { NextResponse } from 'next/server';
import { parseEmailInvoice, SAMPLE_EMAIL_BATCH } from '@/lib/inbox';
import { reconcileWorkspace } from '@/lib/matching';
import { loadWorkspace, saveWorkspace } from '@/lib/store';
import type { Receipt } from '@/lib/types';
import { attachWorkspaceCookie, getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

export async function POST(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const body = (await req.json().catch(() => ({}))) as {
    mode?: 'sync' | 'parse';
    emailRaw?: string;
    source?: 'gmail' | 'outlook' | 'forward_email';
  };

  const addedReceipts: Receipt[] = [];
  let inboxes = state.inboxes;

  if (body.mode === 'parse' && body.emailRaw?.trim()) {
    addedReceipts.push(
      parseEmailInvoice(body.emailRaw, body.source ?? 'forward_email')
    );
  } else {
    const existingKeys = new Set(
      state.receipts.map((r) => `${r.normalizedMerchant}:${r.totalCents}:${r.date}`)
    );
    for (const item of SAMPLE_EMAIL_BATCH) {
      const parsed = parseEmailInvoice(item.raw, item.provider);
      const key = `${parsed.normalizedMerchant}:${parsed.totalCents}:${parsed.date}`;
      if (!existingKeys.has(key)) {
        addedReceipts.push(parsed);
        existingKeys.add(key);
      }
    }
    const nowIso = new Date().toISOString();
    inboxes = state.inboxes.map((inb) => ({
      ...inb,
      lastSyncAt: nowIso,
      syncedCount:
        inb.syncedCount +
        addedReceipts.filter((r) => r.source === inb.provider).length,
    }));
  }

  const reconciled = reconcileWorkspace(
    [...addedReceipts, ...state.receipts],
    state.transactions
  );

  const updated = await saveWorkspace({
    ...state,
    inboxes,
    receipts: reconciled.receipts,
    transactions: reconciled.transactions,
    billing: {
      ...state.billing,
      documentsProcessedThisMonth:
        state.billing.documentsProcessedThisMonth + addedReceipts.length,
    },
  });

  const res = NextResponse.json({
    addedCount: addedReceipts.length,
    addedReceipts,
    workspace: updated,
  });
  return attachWorkspaceCookie(res, workspaceId, isNew);
}
