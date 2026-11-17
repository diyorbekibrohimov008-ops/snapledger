'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Camera,
  CheckCircle2,
  CreditCard,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Unlink,
  Eye,
  X,
} from 'lucide-react';
import type { BankTransaction, Receipt, WorkspaceState } from '@/lib/types';

interface ReconciliationBoardProps {
  workspace: WorkspaceState;
  onUpdateWorkspace: (ws: WorkspaceState, toast?: string) => void;
  onOpenCamera: () => void;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function sourceBadge(source: Receipt['source']) {
  switch (source) {
    case 'camera_pwa':
      return { label: 'PWA Camera', icon: Camera, cls: 'bg-emerald-500/15 text-emerald-300' };
    case 'gmail':
      return { label: 'Gmail Auto', icon: Mail, cls: 'bg-sky-500/15 text-sky-300' };
    case 'outlook':
      return { label: 'Outlook Auto', icon: Mail, cls: 'bg-amber-500/15 text-amber-300' };
    default:
      return { label: 'Forwarded', icon: Mail, cls: 'bg-cyan-500/15 text-cyan-300' };
  }
}

export function ReconciliationBoard({
  workspace,
  onUpdateWorkspace,
  onOpenCamera,
}: ReconciliationBoardProps) {
  const [pairingTxId, setPairingTxId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [inspectedReceipt, setInspectedReceipt] = useState<Receipt | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'unmatched'>('all');

  const receiptMap = new Map(workspace.receipts.map((r) => [r.id, r]));
  const txMap = new Map(workspace.transactions.map((t) => [t.id, t]));

  const visibleTxs =
    filterMode === 'unmatched'
      ? workspace.transactions.filter((t) => t.status !== 'reconciled')
      : workspace.transactions;

  const visibleReceipts =
    filterMode === 'unmatched'
      ? workspace.receipts.filter((r) => r.status !== 'matched')
      : workspace.receipts;

  async function runReconcileAction(
    action: 'pair' | 'unpair' | 'auto',
    receiptId?: string,
    transactionId?: string
  ) {
    setBusyAction(`${action}:${receiptId || ''}:${transactionId || ''}`);
    try {
      const res = await fetch('/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, receiptId, transactionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace: WorkspaceState };
        setPairingTxId(null);
        onUpdateWorkspace(
          data.workspace,
          action === 'pair'
            ? 'Two-way bank match confirmed'
            : action === 'unpair'
              ? 'Unlinked receipt from bank charge'
              : 'Auto-reconciled receipts against Plaid feed'
        );
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function simulateCardSwipe() {
    setBusyAction('simulate');
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_swipe' }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          workspace: WorkspaceState;
          addedTransaction?: BankTransaction;
        };
        const msg = data.addedTransaction
          ? `Pending Plaid charge arrived: ${data.addedTransaction.merchantName} (${fmtUsd(data.addedTransaction.amountCents)})`
          : 'Synced Plaid accounts';
        onUpdateWorkspace(data.workspace, msg);
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteReceipt(id: string) {
    setBusyAction(`del:${id}`);
    try {
      const res = await fetch(`/api/receipts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace: WorkspaceState };
        if (inspectedReceipt?.id === id) setInspectedReceipt(null);
        onUpdateWorkspace(data.workspace, 'Receipt removed');
      }
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filterMode === 'all'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Activity ({workspace.transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('unmatched')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filterMode === 'unmatched'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Action Needed (
            {workspace.transactions.filter((t) => t.status !== 'reconciled').length})
          </button>
          {pairingTxId && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-200">
              Select a receipt on the right to pair
              <button
                type="button"
                onClick={() => setPairingTxId(null)}
                aria-label="Cancel pairing"
                className="text-sky-300 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={simulateCardSwipe}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-500/50 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            Simulate Card Swipe
          </button>
          <button
            type="button"
            onClick={() => runReconcileAction('auto')}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busyAction === 'auto::' ? 'animate-spin' : ''}`} />
            Run 2-Way Match
          </button>
        </div>
      </div>

      {/* Connected Plaid Bank Accounts Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {workspace.accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-emerald-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{acc.name}</div>
                <div className="text-[11px] text-slate-400">
                  Plaid Read-Only •••• {acc.mask}
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live Feed
            </span>
          </div>
        ))}
      </div>

      {/* Side-by-Side Two-Way Matching Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: Plaid Bank Feed */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Plaid Bank &amp; Card Feed
              </h3>
              <p className="text-xs text-slate-400">
                Posted &amp; pending charges requiring receipt proof
              </p>
            </div>
            <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
              {visibleTxs.length} charges
            </span>
          </div>

          <div className="space-y-2.5">
            {visibleTxs.map((tx) => {
              const matched = tx.matchedReceiptId
                ? receiptMap.get(tx.matchedReceiptId)
                : undefined;
              const isSelecting = pairingTxId === tx.id;

              return (
                <div
                  key={tx.id}
                  className={`rounded-xl border p-3.5 transition ${
                    isSelecting
                      ? 'border-sky-400 bg-sky-500/10'
                      : tx.status === 'reconciled'
                        ? 'border-emerald-500/25 bg-slate-950/60'
                        : tx.status === 'needs_review'
                          ? 'border-amber-500/35 bg-amber-500/5'
                          : 'border-rose-500/30 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {tx.merchantName}
                        </span>
                        {tx.pending && (
                          <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {tx.descriptor}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {tx.date} · {tx.accountName} •••• {tx.accountMask}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-white tabular-nums">
                        {fmtUsd(tx.amountCents)}
                      </div>
                      {tx.status === 'reconciled' && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Reconciled ({tx.matchConfidence}%)
                        </span>
                      )}
                      {tx.status === 'needs_review' && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-300">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Review Match ({tx.matchConfidence}%)
                        </span>
                      )}
                      {tx.status === 'missing_receipt' && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-300">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Missing Receipt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Match reasons & actions */}
                  {tx.matchReasons && tx.matchReasons.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {tx.matchReasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                    {matched ? (
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-400" />
                        <span>
                          Paired with <strong className="text-white">{matched.merchant}</strong> (
                          {fmtUsd(matched.totalCents)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Snap a slip or pair an existing receipt
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {tx.status === 'needs_review' && matched && (
                        <button
                          type="button"
                          onClick={() => runReconcileAction('pair', matched.id, tx.id)}
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
                        >
                          Confirm Pair
                        </button>
                      )}
                      {matched ? (
                        <button
                          type="button"
                          onClick={() => runReconcileAction('unpair', matched.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                          <Unlink className="h-3 w-3" />
                          Unlink
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setPairingTxId(isSelecting ? null : tx.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-sky-400 hover:text-sky-300"
                          >
                            <Link2 className="h-3 w-3" />
                            {isSelecting ? 'Cancel Pair' : 'Pair Receipt'}
                          </button>
                          <button
                            type="button"
                            onClick={onOpenCamera}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <Camera className="h-3 w-3" />
                            Snap (3s)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Captured Receipts & Invoices */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Captured Receipts &amp; Email Invoices
              </h3>
              <p className="text-xs text-slate-400">
                Line-item OCR extracted · Zero monthly document limits
              </p>
            </div>
            <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
              {visibleReceipts.length} docs (∞ cap)
            </span>
          </div>

          <div className="space-y-2.5">
            {visibleReceipts.map((rcpt) => {
              const badge = sourceBadge(rcpt.source);
              const BadgeIcon = badge.icon;
              const matchedTx = rcpt.matchedTransactionId
                ? txMap.get(rcpt.matchedTransactionId)
                : undefined;

              return (
                <div
                  key={rcpt.id}
                  className={`rounded-xl border p-3.5 transition ${
                    pairingTxId
                      ? 'border-sky-500/40 bg-slate-950/90 hover:border-sky-400'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {rcpt.merchant}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
                        >
                          <BadgeIcon className="h-3 w-3" />
                          {badge.label}
                        </span>
                        {rcpt.autoCropped && (
                          <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            Auto-Cropped
                            {rcpt.captureTimeMs
                              ? ` · ${(rcpt.captureTimeMs / 1000).toFixed(1)}s`
                              : ''}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {rcpt.date} · {rcpt.category} · OCR {rcpt.ocrConfidence}%
                        {rcpt.cardLast4 ? ` · Card •••• ${rcpt.cardLast4}` : ''}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-white tabular-nums">
                        {fmtUsd(rcpt.totalCents)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {rcpt.lineItems.length} line item
                        {rcpt.lineItems.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  {/* Line-item preview */}
                  {rcpt.lineItems.length > 0 && (
                    <div className="mt-2.5 rounded-lg bg-slate-900/90 px-3 py-2 text-[11px] text-slate-300">
                      {rcpt.lineItems.slice(0, 2).map((li) => (
                        <div key={li.id} className="flex justify-between">
                          <span>
                            {li.quantity}× {li.description}
                          </span>
                          <span className="font-mono text-slate-200">
                            {fmtUsd(li.totalCents)}
                          </span>
                        </div>
                      ))}
                      {(rcpt.taxCents > 0 || rcpt.tipCents > 0) && (
                        <div className="mt-1 flex justify-between border-t border-slate-800 pt-1 text-[10px] text-slate-400">
                          <span>
                            Tax {fmtUsd(rcpt.taxCents)} · Tip {fmtUsd(rcpt.tipCents)}
                          </span>
                          <span>Total {fmtUsd(rcpt.totalCents)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                    {matchedTx ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Matched to {matchedTx.descriptor}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-300">
                        Awaiting matching bank charge
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {pairingTxId && (
                        <button
                          type="button"
                          onClick={() => runReconcileAction('pair', rcpt.id, pairingTxId)}
                          className="rounded-lg bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
                        >
                          Pair with Selected Charge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setInspectedReceipt(rcpt)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                      >
                        <Eye className="h-3 w-3" />
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteReceipt(rcpt.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                        title="Delete receipt"
                        aria-label="Delete receipt"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Receipt Inspection Drawer */}
      {inspectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm overscroll-contain">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-semibold text-white">
                  {inspectedReceipt.merchant}
                </h4>
                <p className="text-xs text-slate-400">
                  {inspectedReceipt.date} · {inspectedReceipt.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedReceipt(null)}
                aria-label="Close inspection drawer"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {inspectedReceipt.imagePath && (
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <img
                    src={inspectedReceipt.imagePath}
                    alt={inspectedReceipt.merchant}
                    className="mx-auto max-h-60 rounded object-contain"
                  />
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap">
                {inspectedReceipt.rawText || 'No raw text stored'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
