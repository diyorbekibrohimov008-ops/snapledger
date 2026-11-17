import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText } from '../src/lib/ocr.ts';

describe('Receipt line-item OCR parser', () => {
  it('parses merchant, date, line items, tax, tip, total, and card last4 from thermal receipt text', () => {
    const raw = `
      BLUE BOTTLE COFFEE
      66 Mint St, San Francisco CA
      Date: 2026-11-11
      2x Iced Latte          $11.00
      1x Almond Croissant     $5.50
      Subtotal               $16.50
      Tax                     $1.42
      Tip                     $2.50
      TOTAL                  $20.42
      VISA ****4821
    `;
    const parsed = parseReceiptText(raw);
    assert.equal(parsed.merchant, 'Blue Bottle Coffee');
    assert.equal(parsed.date, '2026-11-11');
    assert.equal(parsed.subtotalCents, 1650);
    assert.equal(parsed.taxCents, 142);
    assert.equal(parsed.tipCents, 250);
    assert.equal(parsed.totalCents, 2042);
    assert.equal(parsed.cardLast4, '4821');
    assert.equal(parsed.category, 'Meals & Coffee');
    assert.ok(parsed.lineItems.length >= 2);
  });

  it('infers SaaS/hosting category and computes subtotal when only total and tax are shown', () => {
    const raw = `
      VERCEL INC.
      Invoice #INV-9921
      11/09/2026
      Pro Hosting Seat x1    $20.00
      Sales Tax               $0.00
      Amount Paid: $20.00
      Card ending 1008
    `;
    const parsed = parseReceiptText(raw);
    assert.match(parsed.merchant, /Vercel/i);
    assert.equal(parsed.date, '2026-11-09');
    assert.equal(parsed.totalCents, 2000);
    assert.equal(parsed.cardLast4, '1008');
    assert.equal(parsed.category, 'Cloud & Hosting');
  });
});
