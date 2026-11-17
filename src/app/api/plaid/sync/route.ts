import { NextResponse } from 'next/server';
import { reconcileWorkspace } from '@/lib/matching';
import { loadWorkspace, saveWorkspace } from '@/lib/store';
import type { BankTransaction } from '@/lib/types';
import { attachWorkspaceCookie, getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

const SIMULATED_SWIPES: Array<{
  merchantName: string;
  descriptor: string;
  amountCents: number;
  accountId: string;
  accountMask: string;
  accountName: string;
}> = [
  {
    merchantName: 'Sweetgreen',
    descriptor: 'TST* SWEETGREEN #088 SF',
    amountCents: 1945,
    accountId: 'acc_chase_4821',
    accountMask: '4821',
    accountName: 'Chase Ink Business',
  },
  {
    merchantName: 'Delta Air Lines',
    descriptor: 'DELTA AIR 0062319422',
    amountCents: 31840,
    accountId: 'acc_amex_1008',
    accountMask: '1008',
    accountName: 'Amex Business Gold',
  },
  {
    merchantName: 'Whole Foods Market',
    descriptor: 'WHOLEFDS SOMA #1024',
    amountCents: 4680,
    accountId: 'acc_chase_4821',
    accountMask: '4821',
    accountName: 'Chase Ink Business',
  },
  {
    merchantName: 'Linear',
    descriptor: 'LINEAR.APP SAN FRANCISCO',
    amountCents: 2000,
    accountId: 'acc_amex_1008',
    accountMask: '1008',
    accountName: 'Amex Business Gold',
  },
];

export async function POST(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'sync' | 'simulate_swipe';
    merchantName?: string;
    amountCents?: number;
    accountMask?: string;
  };

  const nowIso = new Date().toISOString();
  const today = '2026-11-11';
  let addedTransaction: BankTransaction | undefined;

  if (body.action === 'simulate_swipe') {
    const preset =
      SIMULATED_SWIPES[state.transactions.length % SIMULATED_SWIPES.length];
    const mask = body.accountMask || preset.accountMask;
    const matchedAccount =
      state.accounts.find((a) => a.mask === mask) ?? state.accounts[0];

    const merchant = body.merchantName?.trim() || preset.merchantName;
    const amountCents =
      typeof body.amountCents === 'number' && body.amountCents > 0
        ? body.amountCents
        : preset.amountCents;

    addedTransaction = {
      id: `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      accountId: matchedAccount.id,
      accountMask: matchedAccount.mask,
      accountName: matchedAccount.name,
      merchantName: merchant,
      descriptor: body.merchantName
        ? `${merchant.toUpperCase()} *POS`
        : preset.descriptor,
      date: today,
      amountCents,
      currency: 'USD',
      pending: true,
      status: 'missing_receipt',
      plaidTransactionId: `plaid_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  const nextTransactions = addedTransaction
    ? [addedTransaction, ...state.transactions]
    : state.transactions;

  const accounts = state.accounts.map((a) => ({ ...a, lastSyncedAt: nowIso }));
  const reconciled = reconcileWorkspace(state.receipts, nextTransactions);

  const updated = await saveWorkspace({
    ...state,
    accounts,
    receipts: reconciled.receipts,
    transactions: reconciled.transactions,
  });

  const res = NextResponse.json({
    workspace: updated,
    addedTransaction,
    newMatches: reconciled.newMatches,
    plaidMode: process.env.PLAID_CLIENT_ID ? 'live' : 'sandbox',
  });
  return attachWorkspaceCookie(res, workspaceId, isNew);
}
