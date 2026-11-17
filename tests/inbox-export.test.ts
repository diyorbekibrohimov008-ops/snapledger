import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEmailInvoice } from '../src/lib/inbox.ts';
import { formatQuickBooksCsv, formatXeroCsv } from '../src/lib/export.ts';
import { createInitialWorkspace } from '../src/lib/seed.ts';

describe('Inbox email parser & accounting exports', () => {
  it('extracts invoice details from forwarded Gmail/Outlook message text', () => {
    const emailRaw = `
From: billing@figma.com
Subject: Your Figma invoice for November 2026
Date: 2026-11-10

Thanks for using Figma Professional.
Organization: Acme Design Studio
Figma Design Seat (3 x $15.00)  $45.00
Total Charged: $45.00
Paid with Amex ending in 1008
    `;
    const receipt = parseEmailInvoice(emailRaw, 'gmail');
    assert.match(receipt.merchant, /Figma/i);
    assert.equal(receipt.totalCents, 4500);
    assert.equal(receipt.date, '2026-11-10');
    assert.equal(receipt.cardLast4, '1008');
    assert.equal(receipt.source, 'gmail');
    assert.equal(receipt.category, 'Software & SaaS');
  });

  it('generates valid QuickBooks Online and Xero CSV exports with matched Plaid IDs', () => {
    const ws = createInitialWorkspace('ws_test');
    const qbCsv = formatQuickBooksCsv(ws);
    const xeroCsv = formatXeroCsv(ws);

    assert.ok(qbCsv.startsWith('Date,Merchant,Category,Subtotal,Tax,Tip,Total,Status,PlaidTransactionId,CardLast4'));
    assert.ok(qbCsv.includes('reconciled') || qbCsv.includes('matched'));
    assert.ok(xeroCsv.startsWith('*Date,*Amount,Payee,Description,Reference,ReconciliationStatus'));
    assert.ok(xeroCsv.split('\n').length > 2);
  });
});
