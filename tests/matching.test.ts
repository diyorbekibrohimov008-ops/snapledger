import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMerchant,
  scoreReceiptToTransaction,
  reconcileWorkspace,
  pairReceiptAndTransaction,
  unpairReceiptAndTransaction,
} from '../src/lib/matching.ts';
import type { BankTransaction, Receipt } from '../src/lib/types.ts';

function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'rcpt_1',
    merchant: 'Blue Bottle Coffee',
    normalizedMerchant: 'blue bottle coffee',
    date: '2026-11-10',
    subtotalCents: 1250,
    taxCents: 108,
    tipCents: 200,
    totalCents: 1558,
    currency: 'USD',
    cardLast4: '4821',
    category: 'Meals & Coffee',
    source: 'camera_pwa',
    status: 'unmatched',
    ocrConfidence: 96,
    autoCropped: true,
    lineItems: [],
    createdAt: '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}

function makeTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 'tx_1',
    accountId: 'acc_1',
    accountMask: '4821',
    accountName: 'Chase Ink Business',
    merchantName: 'Blue Bottle Coffee',
    descriptor: 'SQ *BLUE BOTTLE SF',
    date: '2026-11-10',
    amountCents: 1558,
    currency: 'USD',
    pending: true,
    status: 'missing_receipt',
    plaidTransactionId: 'plaid_tx_1',
    ...overrides,
  };
}

describe('Two-way bank matching engine', () => {
  it('normalizes bank descriptors by stripping card-processor prefixes and store codes', () => {
    assert.equal(normalizeMerchant('SQ *BLUE BOTTLE SF'), 'blue bottle');
    assert.equal(normalizeMerchant('AMZN MKTP US*2K49A1'), 'amazon');
    assert.equal(normalizeMerchant('TST* Sweetgreen #041'), 'sweetgreen');
  });

  it('auto-matches exact amount, date, card mask, and merchant alias on pending charges', () => {
    const receipt = makeReceipt();
    const tx = makeTx({ pending: true });
    const result = scoreReceiptToTransaction(receipt, tx);

    assert.ok(result.confidence >= 85, `expected >= 85, got ${result.confidence}`);
    assert.equal(result.tier, 'auto');
    assert.ok(result.reasons.some((r) => r.includes('Exact Amount')));
    assert.ok(result.reasons.some((r) => r.includes('Pending Charge')));
    assert.ok(result.reasons.some((r) => r.includes('4821')));
  });

  it('matches pending pre-tip card auth against final receipt total including tip', () => {
    const receipt = makeReceipt({
      subtotalCents: 4200,
      taxCents: 350,
      tipCents: 800,
      totalCents: 5350,
    });
    // Pending auth settled before tip added ($45.50 vs $53.50)
    const tx = makeTx({
      amountCents: 4550,
      pending: true,
    });
    const result = scoreReceiptToTransaction(receipt, tx);
    assert.ok(result.confidence >= 70, `expected >= 70, got ${result.confidence}`);
    assert.ok(result.reasons.some((r) => r.includes('Tip') || r.includes('Pending')));
  });

  it('prefers the transaction whose card mask matches when amounts tie', () => {
    const r1 = makeReceipt({ id: 'r1', cardLast4: '4821', merchant: 'Uber', normalizedMerchant: 'uber', totalCents: 2490 });
    const txWrongCard = makeTx({
      id: 'tx_wrong',
      accountMask: '1008',
      merchantName: 'Uber',
      descriptor: 'UBER *TRIP',
      amountCents: 2490,
    });
    const txRightCard = makeTx({
      id: 'tx_right',
      accountMask: '4821',
      merchantName: 'Uber',
      descriptor: 'UBER *TRIP',
      amountCents: 2490,
    });

    const reconciled = reconcileWorkspace([r1], [txWrongCard, txRightCard]);
    assert.equal(reconciled.receipts[0].matchedTransactionId, 'tx_right');
    assert.equal(reconciled.transactions.find((t) => t.id === 'tx_right')?.status, 'reconciled');
    assert.equal(reconciled.transactions.find((t) => t.id === 'tx_wrong')?.status, 'missing_receipt');
  });

  it('supports manual two-way pairing and unpairing symmetrically', () => {
    const r = makeReceipt({ id: 'r_manual' });
    const tx = makeTx({ id: 'tx_manual' });

    const paired = pairReceiptAndTransaction([r], [tx], 'r_manual', 'tx_manual');
    assert.equal(paired.receipts[0].status, 'matched');
    assert.equal(paired.receipts[0].matchedTransactionId, 'tx_manual');
    assert.equal(paired.transactions[0].status, 'reconciled');
    assert.equal(paired.transactions[0].matchedReceiptId, 'r_manual');

    const unpaired = unpairReceiptAndTransaction(paired.receipts, paired.transactions, 'r_manual');
    assert.equal(unpaired.receipts[0].status, 'unmatched');
    assert.equal(unpaired.receipts[0].matchedTransactionId, undefined);
    assert.equal(unpaired.transactions[0].status, 'missing_receipt');
    assert.equal(unpaired.transactions[0].matchedReceiptId, undefined);
  });
});
