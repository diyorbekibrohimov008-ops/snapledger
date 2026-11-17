import { NextResponse } from 'next/server';
import { loadWorkspace, saveWorkspace } from '@/lib/store';
import type { PlanTier } from '@/lib/types';
import { attachWorkspaceCookie, getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

export async function POST(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const body = (await req.json().catch(() => ({}))) as {
    plan?: PlanTier;
    toggleAccounting?: 'quickbooks' | 'xero';
    autoSyncMatched?: boolean;
  };

  let billing = state.billing;
  if (body.plan === 'solo' || body.plan === 'team') {
    billing = {
      ...state.billing,
      plan: body.plan,
      monthlyPriceUsd: body.plan === 'solo' ? 15 : 19,
      billingCycle: 'monthly',
      documentCap: null,
      cancelAnytime: true,
    };
  }

  let accounting = state.accounting;
  if (body.toggleAccounting) {
    accounting = state.accounting.map((a) => {
      if (a.provider !== body.toggleAccounting) return a;
      const connected =
        body.autoSyncMatched !== undefined ? a.connected : !a.connected;
      return {
        ...a,
        connected,
        autoSyncMatched:
          body.autoSyncMatched !== undefined
            ? body.autoSyncMatched
            : connected,
        companyName:
          a.provider === 'xero' && connected && a.companyName.startsWith('Connect')
            ? 'Acme Design Studio (Xero)'
            : a.companyName,
      };
    });
  }

  const updated = await saveWorkspace({
    ...state,
    billing,
    accounting,
  });

  const res = NextResponse.json({ workspace: updated });
  return attachWorkspaceCookie(res, workspaceId, isNew);
}
