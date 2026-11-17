import { NextResponse } from 'next/server';
import { reconcileWorkspace } from '@/lib/matching';
import { extractReceiptWithOptionalAI } from '@/lib/ocr';
import { loadWorkspace, saveReceiptImage, saveWorkspace } from '@/lib/store';
import type { ExpenseCategory, Receipt, ReceiptSource } from '@/lib/types';
import { attachWorkspaceCookie, getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

export async function POST(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const body = (await req.json().catch(() => ({}))) as {
    rawText?: string;
    imageBase64?: string;
    source?: ReceiptSource;
    autoCropped?: boolean;
    captureTimeMs?: number;
    fallbackMerchant?: string;
    fallbackAmountCents?: number;
    fallbackDate?: string;
    fallbackCardLast4?: string;
    notes?: string;
  };

  const parsed = await extractReceiptWithOptionalAI({
    rawText: body.rawText,
    imageBase64: body.imageBase64,
    fallbackMerchant: body.fallbackMerchant,
    fallbackAmountCents: body.fallbackAmountCents,
    fallbackDate: body.fallbackDate,
    fallbackCardLast4: body.fallbackCardLast4,
  });

  const receiptId = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  let imagePath: string | undefined;
  if (body.imageBase64) {
    imagePath = await saveReceiptImage(workspaceId, receiptId, body.imageBase64);
  }

  const newReceipt: Receipt = {
    id: receiptId,
    merchant: parsed.merchant,
    normalizedMerchant: parsed.normalizedMerchant,
    date: parsed.date,
    subtotalCents: parsed.subtotalCents,
    taxCents: parsed.taxCents,
    tipCents: parsed.tipCents,
    totalCents: parsed.totalCents,
    currency: parsed.currency,
    cardLast4: parsed.cardLast4,
    category: parsed.category,
    source: body.source ?? 'camera_pwa',
    status: 'unmatched',
    ocrConfidence: parsed.ocrConfidence,
    imagePath,
    autoCropped: Boolean(body.autoCropped),
    captureTimeMs: body.captureTimeMs,
    rawText: parsed.rawText,
    notes: body.notes,
    lineItems: parsed.lineItems,
    createdAt: new Date().toISOString(),
  };

  const reconciled = reconcileWorkspace([newReceipt, ...state.receipts], state.transactions);

  const updated = await saveWorkspace({
    ...state,
    receipts: reconciled.receipts,
    transactions: reconciled.transactions,
    billing: {
      ...state.billing,
      documentsProcessedThisMonth: state.billing.documentsProcessedThisMonth + 1,
    },
  });

  const createdReceipt = updated.receipts.find((r) => r.id === receiptId) ?? newReceipt;
  const res = NextResponse.json({
    receipt: createdReceipt,
    workspace: updated,
    newMatches: reconciled.newMatches,
  });
  return attachWorkspaceCookie(res, workspaceId, isNew);
}

export async function PATCH(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    category?: ExpenseCategory;
    notes?: string;
    merchant?: string;
    totalCents?: number;
  };

  if (!body.id) {
    return NextResponse.json({ error: 'Receipt id required' }, { status: 400 });
  }

  const receipts = state.receipts.map((r) => {
    if (r.id !== body.id) return r;
    return {
      ...r,
      category: body.category ?? r.category,
      notes: body.notes !== undefined ? body.notes : r.notes,
      merchant: body.merchant ?? r.merchant,
      totalCents: typeof body.totalCents === 'number' ? body.totalCents : r.totalCents,
    };
  });

  const reconciled = reconcileWorkspace(receipts, state.transactions);
  const updated = await saveWorkspace({
    ...state,
    receipts: reconciled.receipts,
    transactions: reconciled.transactions,
  });
  const res = NextResponse.json({ workspace: updated });
  return attachWorkspaceCookie(res, workspaceId, isNew);
}

export async function DELETE(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Receipt id required' }, { status: 400 });
  }

  const remainingReceipts = state.receipts.filter((r) => r.id !== id);
  const transactions = state.transactions.map((t) =>
    t.matchedReceiptId === id
      ? {
          ...t,
          matchedReceiptId: undefined,
          status: 'missing_receipt' as const,
          matchConfidence: undefined,
          matchReasons: undefined,
        }
      : t
  );

  const reconciled = reconcileWorkspace(remainingReceipts, transactions);
  const updated = await saveWorkspace({
    ...state,
    receipts: reconciled.receipts,
    transactions: reconciled.transactions,
  });

  const res = NextResponse.json({ workspace: updated });
  return attachWorkspaceCookie(res, workspaceId, isNew);
}
