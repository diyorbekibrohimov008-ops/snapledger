import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialWorkspace } from '../src/lib/seed.ts';
import { reconcileWorkspace, pairReceiptAndTransaction } from '../src/lib/matching.ts';
import { parseReceiptText } from '../src/lib/ocr.ts';

describe('End-to-end workspace bookkeeping flow', () => {
  it('ingests a newly snapped receipt and auto-reconciles it against a pending bank charge', () => {
    const ws = createInitialWorkspace('ws_flow');

    // Sweetgreen pending charge exists in seed as missing_receipt ($18.75 on card 4821)
    const missingSweetgreen = ws.transactions.find((t) => t.id === 'tx_sweetgreen_missing');
    assert.equal(missingSweetgreen?.status, 'missing_receipt');

    // User snaps a paper Sweetgreen receipt via 3s mobile camera PWA
    const parsed = parseReceiptText(`
      SWEETGREEN
      2026-11-11
      1x Harvest Bowl       $16.25
      Tax                    $1.50
      Tip                    $1.00
      TOTAL                 $18.75
      VISA ****4821
    `);

    const newReceipt = {
      id: 'rcpt_sg_new',
      ...parsed,
      source: 'camera_pwa' as const,
      status: 'unmatched' as const,
      autoCropped: true,
      captureTimeMs: 2400,
      createdAt: '2026-11-11T16:30:00.000Z',
    };

    const reconciled = reconcileWorkspace([newReceipt, ...ws.receipts], ws.transactions);
    const matchedReceipt = reconciled.receipts.find((r) => r.id === 'rcpt_sg_new');
    const matchedTx = reconciled.transactions.find((t) => t.id === 'tx_sweetgreen_missing');

    assert.equal(matchedReceipt?.status, 'matched');
    assert.equal(matchedReceipt?.matchedTransactionId, 'tx_sweetgreen_missing');
    assert.equal(matchedTx?.status, 'reconciled');
    assert.equal(matchedTx?.matchedReceiptId, 'rcpt_sg_new');
  });

  it('tracks unlimited documents processed without any cap blocking ingestion', () => {
    const ws = createInitialWorkspace('ws_unlimited');
    assert.equal(ws.billing.documentCap, null);
    assert.equal(ws.billing.billingCycle, 'monthly');
    assert.ok(ws.billing.documentsProcessedThisMonth > 50); // already past WellyBox's 50-doc cap!

    const paired = pairReceiptAndTransaction(ws.receipts, ws.transactions, 'rcpt_apple_pending', 'tx_homedepot_missing');
    assert.equal(paired.receipts.find((r) => r.id === 'rcpt_apple_pending')?.matchedTransactionId, 'tx_homedepot_missing');
  });
});
