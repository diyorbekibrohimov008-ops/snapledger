export type PlanTier = 'solo' | 'team';

export type ReceiptSource =
  | 'camera_pwa'
  | 'gmail'
  | 'outlook'
  | 'upload'
  | 'forward_email';

export type ExpenseCategory =
  | 'Software & SaaS'
  | 'Meals & Coffee'
  | 'Travel & Rideshare'
  | 'Office & Hardware'
  | 'Cloud & Hosting'
  | 'Utilities & Internet'
  | 'Other';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  category?: string;
}

export interface Receipt {
  id: string;
  merchant: string;
  normalizedMerchant: string;
  date: string; // YYYY-MM-DD
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  currency: string;
  cardLast4?: string;
  category: ExpenseCategory;
  source: ReceiptSource;
  status: 'matched' | 'needs_review' | 'unmatched';
  matchedTransactionId?: string;
  matchConfidence?: number;
  matchReasons?: string[];
  ocrConfidence: number;
  imagePath?: string;
  autoCropped: boolean;
  captureTimeMs?: number;
  rawText?: string;
  notes?: string;
  lineItems: LineItem[];
  createdAt: string;
}

export interface BankAccount {
  id: string;
  institution: string;
  name: string;
  mask: string;
  type: 'credit' | 'checking';
  lastSyncedAt: string;
  plaidItemId: string;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  accountMask: string;
  accountName: string;
  merchantName: string;
  descriptor: string;
  date: string; // YYYY-MM-DD
  amountCents: number;
  currency: string;
  pending: boolean;
  status: 'reconciled' | 'needs_review' | 'missing_receipt';
  matchedReceiptId?: string;
  matchConfidence?: number;
  matchReasons?: string[];
  plaidTransactionId: string;
}

export interface InboxConnection {
  id: string;
  provider: 'gmail' | 'outlook';
  email: string;
  status: 'connected' | 'syncing';
  lastSyncAt: string;
  rules: string[];
  syncedCount: number;
}

export interface AccountingIntegration {
  provider: 'quickbooks' | 'xero';
  connected: boolean;
  companyName: string;
  lastExportAt?: string;
  autoSyncMatched: boolean;
}

export interface BillingState {
  plan: PlanTier;
  billingCycle: 'monthly';
  monthlyPriceUsd: 15 | 19;
  documentCap: null;
  documentsProcessedThisMonth: number;
  cancelAnytime: boolean;
}

export interface WorkspaceState {
  workspaceId: string;
  businessName: string;
  forwardingAddress: string;
  receipts: Receipt[];
  transactions: BankTransaction[];
  accounts: BankAccount[];
  inboxes: InboxConnection[];
  accounting: AccountingIntegration[];
  billing: BillingState;
  updatedAt: string;
}

export interface MatchCandidate {
  receiptId: string;
  transactionId: string;
  confidence: number;
  tier: 'auto' | 'review' | 'none';
  reasons: string[];
}
