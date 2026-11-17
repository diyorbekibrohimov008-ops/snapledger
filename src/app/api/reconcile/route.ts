import { NextResponse } from 'next/server';
import {
  pairReceiptAndTransaction,
  reconcileWorkspace,
  unpairReceiptAndTransaction,
} from '@/lib/matching';
import { loadWorkspace, saveWorkspace } from '@/lib/store';
import { attachWorkspaceCookie, getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

export async function POST(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'pair' | 'unpair' | 'auto';
    receiptId?: string;
    transactionId?: string;
  };

  let nextReceipts = state.receipts;
  let nextTransactions = state.transactions;

  if (body.action === 'pair' && body.receiptId && body.transactionId) {
    const paired = pairReceiptAndTransaction(
      state.receipts,
      state.transactions,
      body.receiptId,
      body.transactionId
    );
    nextReceipts = paired.receipts;
    nextTransactions = paired.transactions;
  } else if (body.action === 'unpair' && body.receiptId) {
    const unpaired = unpairReceiptAndTransaction(
      state.receipts,
      state.transactions,
      body.receiptId
    );
    nextReceipts = unpaired.receipts;
    nextTransactions = unpaired.transactions;
  } else {
    const auto = reconcileWorkspace(state.receipts, state.transactions);
    nextReceipts = auto.receipts;
    nextTransactions = auto.transactions;
  }

  const updated = await saveWorkspace({
    ...state,
    receipts: nextReceipts,
    transactions: nextTransactions,
  });

  const res = NextResponse.json({ workspace: updated });
  return attachWorkspaceCookie(res, workspaceId, isNew);
}
