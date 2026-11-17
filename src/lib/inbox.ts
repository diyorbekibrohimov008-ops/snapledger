import { normalizeMerchant } from './matching.ts';
import { parseReceiptText } from './ocr.ts';
import type { Receipt, ReceiptSource } from './types.ts';

export function parseEmailInvoice(
  emailRaw: string,
  source: Extract<ReceiptSource, 'gmail' | 'outlook' | 'forward_email'> = 'forward_email'
): Receipt {
  const fromMatch = emailRaw.match(/^From:\s*(.+)$/im);
  const subjectMatch = emailRaw.match(/^Subject:\s*(.+)$/im);

  let inferredVendor = '';
  if (fromMatch) {
    const domainMatch = fromMatch[1].match(/@([a-z0-9-]+)\./i);
    if (domainMatch) {
      const dom = domainMatch[1];
      inferredVendor = dom.charAt(0).toUpperCase() + dom.slice(1);
    }
  }
  if (!inferredVendor && subjectMatch) {
    const subj = subjectMatch[1]
      .replace(/your|invoice|receipt|for|november|october|202\d/gi, ' ')
      .trim();
    if (subj) inferredVendor = subj.split(/\s+/).slice(0, 2).join(' ');
  }

  const parsed = parseReceiptText(emailRaw, {
    fallbackMerchant: inferredVendor || 'Email Vendor',
  });

  const merchant =
    inferredVendor && parsed.merchant === 'Thanks for using Figma Professional.'
      ? inferredVendor
      : inferredVendor && parsed.merchant.length > 36
        ? inferredVendor
        : inferredVendor &&
            parsed.merchant.toLowerCase().includes(inferredVendor.toLowerCase()) === false &&
            parsed.merchant === 'Scanned Merchant'
          ? inferredVendor
          : inferredVendor || parsed.merchant;

  return {
    id: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    merchant,
    normalizedMerchant: normalizeMerchant(merchant),
    date: parsed.date,
    subtotalCents: parsed.subtotalCents,
    taxCents: parsed.taxCents,
    tipCents: parsed.tipCents,
    totalCents: parsed.totalCents,
    currency: parsed.currency,
    cardLast4: parsed.cardLast4,
    category: parsed.category,
    source,
    status: 'unmatched',
    ocrConfidence: Math.max(parsed.ocrConfidence, 95),
    autoCropped: false,
    rawText: emailRaw.trim(),
    lineItems: parsed.lineItems,
    createdAt: new Date().toISOString(),
  };
}

export const SAMPLE_EMAIL_BATCH: Array<{
  provider: 'gmail' | 'outlook';
  raw: string;
}> = [
  {
    provider: 'gmail',
    raw: `From: receipts@linear.app
Subject: Your Linear workspace receipt
Date: 2026-11-11

Linear Software Inc.
Standard Plan (2 seats x $10.00)  $20.00
Tax                               $0.00
Total Charged: $20.00
Card ending in 1008`,
  },
  {
    provider: 'outlook',
    raw: `From: no-reply@aws.amazon.com
Subject: Amazon Web Services Billing Statement
Date: 2026-11-09

AWS Cloud Services
EC2 & RDS Compute Usage           $64.20
S3 Storage & Bandwidth             $8.40
Total: $72.60
Paid with Chase Ink ending 4821`,
  },
];
