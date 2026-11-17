import type { WorkspaceState } from './types.ts';

function csvCell(value: string | number | undefined): string {
  const str = value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

const ACCOUNT_CODE_MAP: Record<string, string> = {
  'Software & SaaS': '6120 Software & Subscriptions',
  'Cloud & Hosting': '6130 Cloud Infrastructure',
  'Meals & Coffee': '6410 Meals & Client Entertainment',
  'Travel & Rideshare': '6420 Travel & Transit',
  'Office & Hardware': '6200 Office Equipment & Supplies',
  'Utilities & Internet': '6300 Telecom & Internet',
  Other: '6900 General Operating Expense',
};

export function formatQuickBooksCsv(ws: WorkspaceState): string {
  const txMap = new Map(ws.transactions.map((t) => [t.id, t]));
  const header =
    'Date,Merchant,Category,Subtotal,Tax,Tip,Total,Status,PlaidTransactionId,CardLast4';
  const rows = ws.receipts.map((r) => {
    const matchedTx = r.matchedTransactionId ? txMap.get(r.matchedTransactionId) : undefined;
    const account = ACCOUNT_CODE_MAP[r.category] ?? ACCOUNT_CODE_MAP.Other;
    return [
      csvCell(r.date),
      csvCell(r.merchant),
      csvCell(account),
      csvCell(dollars(r.subtotalCents)),
      csvCell(dollars(r.taxCents)),
      csvCell(dollars(r.tipCents)),
      csvCell(dollars(r.totalCents)),
      csvCell(r.status),
      csvCell(matchedTx?.plaidTransactionId ?? ''),
      csvCell(r.cardLast4 ?? matchedTx?.accountMask ?? ''),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function formatXeroCsv(ws: WorkspaceState): string {
  const receiptMap = new Map(ws.receipts.map((r) => [r.id, r]));
  const header = '*Date,*Amount,Payee,Description,Reference,ReconciliationStatus';
  const rows = ws.transactions.map((tx) => {
    const matchedReceipt = tx.matchedReceiptId ? receiptMap.get(tx.matchedReceiptId) : undefined;
    const description = matchedReceipt
      ? `${matchedReceipt.category} (${matchedReceipt.lineItems.length || 1} items)`
      : tx.descriptor;
    return [
      csvCell(tx.date),
      csvCell(`-${dollars(tx.amountCents)}`),
      csvCell(tx.merchantName),
      csvCell(description),
      csvCell(tx.plaidTransactionId),
      csvCell(tx.status),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}
