import type { BankTransaction, MatchCandidate, Receipt } from './types.ts';

const PROCESSOR_PREFIXES = [
  /^sq\s*\*\s*/i,
  /^tst\s*\*\s*/i,
  /^paypal\s*\*\s*/i,
  /^stripe\s*\*\s*/i,
  /^sp\s+/i,
  /^in\s*\*\s*/i,
];

const MERCHANT_ALIASES: Array<[RegExp, string]> = [
  [/\bamzn\s*mktp\b|\bamazon(\.com)?\b/i, 'amazon'],
  [/\buber\s*\*?\s*(trip|eats)?\b/i, 'uber'],
  [/\blyft\s*\*?\s*ride\b/i, 'lyft'],
  [/\bapple\.com\/bill\b|\bapple\s+store\b/i, 'apple'],
  [/\bgoogle\s*\*?\s*(cloud|workspace|gsuite)\b/i, 'google cloud'],
  [/\baws\b|\bamazon web services\b/i, 'aws'],
  [/\bvercel\b/i, 'vercel'],
  [/\bfigma\b/i, 'figma'],
  [/\bblue\s*bottle\b/i, 'blue bottle'],
  [/\bsweetgreen\b/i, 'sweetgreen'],
  [/\bdelta\s*air\b/i, 'delta air lines'],
  [/\bwhole\s*foods\b/i, 'whole foods'],
  [/\bhome\s*depot\b/i, 'home depot'],
];

export function normalizeMerchant(input: string): string {
  let clean = input.trim();
  for (const prefix of PROCESSOR_PREFIXES) {
    clean = clean.replace(prefix, '');
  }
  clean = clean
    .replace(/\*\w{4,}/g, ' ')
    .replace(/#\d+/g, ' ')
    .replace(/[^a-zA-Z0-9\s.&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  for (const [pattern, canonical] of MERCHANT_ALIASES) {
    if (pattern.test(clean)) {
      return canonical;
    }
  }
  return clean;
}

function bigrams(str: string): Set<string> {
  const s = str.replace(/\s+/g, '');
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i += 1) {
    out.add(s.slice(i, i + 2));
  }
  return out;
}

export function merchantSimilarity(a: string, b: string): number {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const tokensA = new Set(na.split(' ').filter(Boolean));
  const tokensB = new Set(nb.split(' ').filter(Boolean));
  let tokenIntersect = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) tokenIntersect += 1;
  }
  const tokenUnion = new Set([...tokensA, ...tokensB]).size;
  const tokenJaccard = tokenUnion > 0 ? tokenIntersect / tokenUnion : 0;

  const bgA = bigrams(na);
  const bgB = bigrams(nb);
  let bgIntersect = 0;
  for (const g of bgA) {
    if (bgB.has(g)) bgIntersect += 1;
  }
  const bgDice = bgA.size + bgB.size > 0 ? (2 * bgIntersect) / (bgA.size + bgB.size) : 0;

  return Math.max(tokenJaccard, bgDice);
}

function daysBetween(dateA: string, dateB: string): number {
  const a = Date.parse(`${dateA}T00:00:00Z`);
  const b = Date.parse(`${dateB}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 30;
  return Math.abs(Math.round((a - b) / 86_400_000));
}

export function scoreReceiptToTransaction(
  receipt: Receipt,
  tx: BankTransaction
): MatchCandidate {
  let score = 0;
  const reasons: string[] = [];

  // 1. Amount matching (max 45 pts)
  const diffCents = Math.abs(receipt.totalCents - tx.amountCents);
  const preTipTotal = receipt.subtotalCents + receipt.taxCents;
  const preTipDiff = Math.abs(preTipTotal - tx.amountCents);
  const pctDiff =
    tx.amountCents > 0 ? diffCents / Math.max(tx.amountCents, receipt.totalCents) : 1;

  if (diffCents === 0) {
    score += 45;
    reasons.push('Exact Amount');
  } else if (
    (tx.pending || receipt.tipCents > 0) &&
    (preTipDiff <= 200 || (tx.amountCents < receipt.totalCents && pctDiff <= 0.25))
  ) {
    score += 36;
    reasons.push('Pending Auth / Tip Variance');
  } else if (diffCents <= 150 || pctDiff <= 0.03) {
    score += 28;
    reasons.push('Near Amount');
  } else if (pctDiff > 0.35) {
    score -= 35;
  }

  // 2. Date proximity (max 25 pts)
  const dayGap = daysBetween(receipt.date, tx.date);
  if (dayGap === 0) {
    score += 25;
    reasons.push('Same Day');
  } else if (dayGap <= 2) {
    score += 20;
    reasons.push(`${dayGap}d Settlement Window`);
  } else if (dayGap <= 5) {
    score += 12;
    reasons.push(`${dayGap}d Date Proximity`);
  } else if (dayGap > 10) {
    score -= 20;
  }

  // 3. Merchant similarity (max 25 pts)
  const sim = Math.max(
    merchantSimilarity(receipt.merchant, tx.merchantName),
    merchantSimilarity(receipt.merchant, tx.descriptor)
  );
  if (sim >= 0.85) {
    score += 25;
    reasons.push('Merchant Match');
  } else if (sim >= 0.45) {
    score += 16;
    reasons.push('Merchant Alias');
  } else if (sim < 0.2) {
    score -= 10;
  }

  // 4. Card mask verification (+15 pts or -10 pts)
  if (receipt.cardLast4 && tx.accountMask) {
    if (receipt.cardLast4 === tx.accountMask) {
      score += 15;
      reasons.push(`Card •••• ${tx.accountMask}`);
    } else {
      score -= 10;
    }
  }

  const confidence = Math.max(0, Math.min(100, Math.round(score)));
  if (tx.pending && confidence >= 55) {
    reasons.push('Pending Charge Pair');
  }

  const tier: MatchCandidate['tier'] =
    confidence >= 82 ? 'auto' : confidence >= 55 ? 'review' : 'none';

  return {
    receiptId: receipt.id,
    transactionId: tx.id,
    confidence,
    tier,
    reasons,
  };
}

export function reconcileWorkspace(
  receiptsInput: Receipt[],
  transactionsInput: BankTransaction[]
): {
  receipts: Receipt[];
  transactions: BankTransaction[];
  newMatches: MatchCandidate[];
} {
  const receipts = receiptsInput.map((r) => ({ ...r }));
  const transactions = transactionsInput.map((t) => ({ ...t }));

  const receiptById = new Map(receipts.map((r) => [r.id, r]));
  const txById = new Map(transactions.map((t) => [t.id, t]));

  const usedReceipts = new Set<string>();
  const usedTxs = new Set<string>();

  // Preserve valid already-paired records
  for (const r of receipts) {
    if (r.matchedTransactionId && txById.has(r.matchedTransactionId)) {
      const tx = txById.get(r.matchedTransactionId)!;
      if (tx.matchedReceiptId === r.id || !tx.matchedReceiptId) {
        tx.matchedReceiptId = r.id;
        tx.status = r.status === 'matched' ? 'reconciled' : 'needs_review';
        usedReceipts.add(r.id);
        usedTxs.add(tx.id);
      }
    }
  }

  // Score all unpaired combinations
  const candidates: MatchCandidate[] = [];
  for (const r of receipts) {
    if (usedReceipts.has(r.id)) continue;
    for (const tx of transactions) {
      if (usedTxs.has(tx.id)) continue;
      const cand = scoreReceiptToTransaction(r, tx);
      if (cand.tier !== 'none') {
        candidates.push(cand);
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  const newMatches: MatchCandidate[] = [];
  for (const cand of candidates) {
    if (usedReceipts.has(cand.receiptId) || usedTxs.has(cand.transactionId)) {
      continue;
    }
    const r = receiptById.get(cand.receiptId)!;
    const tx = txById.get(cand.transactionId)!;

    r.matchedTransactionId = tx.id;
    r.matchConfidence = cand.confidence;
    r.matchReasons = cand.reasons;
    r.status = cand.tier === 'auto' ? 'matched' : 'needs_review';

    tx.matchedReceiptId = r.id;
    tx.matchConfidence = cand.confidence;
    tx.matchReasons = cand.reasons;
    tx.status = cand.tier === 'auto' ? 'reconciled' : 'needs_review';

    usedReceipts.add(r.id);
    usedTxs.add(tx.id);
    newMatches.push(cand);
  }

  // Normalize leftover unmatched records
  for (const r of receipts) {
    if (!usedReceipts.has(r.id)) {
      r.status = 'unmatched';
      r.matchedTransactionId = undefined;
      r.matchConfidence = undefined;
      r.matchReasons = undefined;
    }
  }
  for (const tx of transactions) {
    if (!usedTxs.has(tx.id)) {
      tx.status = 'missing_receipt';
      tx.matchedReceiptId = undefined;
      tx.matchConfidence = undefined;
      tx.matchReasons = undefined;
    }
  }

  return { receipts, transactions, newMatches };
}

export function pairReceiptAndTransaction(
  receiptsInput: Receipt[],
  transactionsInput: BankTransaction[],
  receiptId: string,
  transactionId: string
): { receipts: Receipt[]; transactions: BankTransaction[] } {
  const receipts = receiptsInput.map((r) => ({ ...r }));
  const transactions = transactionsInput.map((t) => ({ ...t }));

  const targetReceipt = receipts.find((r) => r.id === receiptId);
  const targetTx = transactions.find((t) => t.id === transactionId);
  if (!targetReceipt || !targetTx) {
    return { receipts, transactions };
  }

  // Clear any prior pairing on either side
  for (const r of receipts) {
    if (r.matchedTransactionId === transactionId && r.id !== receiptId) {
      r.matchedTransactionId = undefined;
      r.status = 'unmatched';
      r.matchConfidence = undefined;
      r.matchReasons = undefined;
    }
  }
  for (const tx of transactions) {
    if (tx.matchedReceiptId === receiptId && tx.id !== transactionId) {
      tx.matchedReceiptId = undefined;
      tx.status = 'missing_receipt';
      tx.matchConfidence = undefined;
      tx.matchReasons = undefined;
    }
  }

  const cand = scoreReceiptToTransaction(targetReceipt, targetTx);
  const reasons = cand.reasons.includes('Manual Confirmed')
    ? cand.reasons
    : [...cand.reasons, 'Manual Confirmed'];
  const confidence = Math.max(cand.confidence, 95);

  targetReceipt.matchedTransactionId = targetTx.id;
  targetReceipt.status = 'matched';
  targetReceipt.matchConfidence = confidence;
  targetReceipt.matchReasons = reasons;

  targetTx.matchedReceiptId = targetReceipt.id;
  targetTx.status = 'reconciled';
  targetTx.matchConfidence = confidence;
  targetTx.matchReasons = reasons;

  return { receipts, transactions };
}

export function unpairReceiptAndTransaction(
  receiptsInput: Receipt[],
  transactionsInput: BankTransaction[],
  receiptId: string
): { receipts: Receipt[]; transactions: BankTransaction[] } {
  const receipts = receiptsInput.map((r) => ({ ...r }));
  const transactions = transactionsInput.map((t) => ({ ...t }));

  const targetReceipt = receipts.find((r) => r.id === receiptId);
  if (!targetReceipt) return { receipts, transactions };

  const txId = targetReceipt.matchedTransactionId;
  targetReceipt.matchedTransactionId = undefined;
  targetReceipt.status = 'unmatched';
  targetReceipt.matchConfidence = undefined;
  targetReceipt.matchReasons = undefined;

  if (txId) {
    const tx = transactions.find((t) => t.id === txId);
    if (tx) {
      tx.matchedReceiptId = undefined;
      tx.status = 'missing_receipt';
      tx.matchConfidence = undefined;
      tx.matchReasons = undefined;
    }
  }

  return { receipts, transactions };
}
