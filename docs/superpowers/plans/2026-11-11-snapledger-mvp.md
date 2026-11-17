# SnapLedger Full MVP Implementation Plan

**Goal:** Build and deploy **SnapLedger**, a full-stack receipt & invoice bookkeeping web app and installable mobile PWA built to win freelancers and SMBs switching from WellyBox and SparkReceipt.

**Architecture:**
- **Frontend & PWA:** Next.js App Router + React + Tailwind CSS with installable PWA support (`manifest.webmanifest`, `sw.js`), mobile bottom-bar quick camera capture, client-side Canvas edge detection / auto-crop + scan enhancement, two-way Plaid bank reconciliation board, Gmail/Outlook inbox scraping simulator + live email/EML parser, QuickBooks/Xero export generator, and transparent flat month-to-month unlimited pricing (\$15–\$19/mo, zero document caps).
- **Backend & Storage:** Next.js Route Handlers running on Node.js 24 (Fluid Compute on Vercel). Pure TypeScript domain modules (`src/lib/`) power OCR/invoice extraction, two-way bank-charge matching (`src/lib/matching.ts`), inbox parsing (`src/lib/inbox.ts`), and QuickBooks/Xero exports (`src/lib/export.ts`). Persistence uses Vercel Blob (`@vercel/blob`) scoped by workspace session cookie (`sl_ws`) with an automatic in-memory fallback for local dev/testing. Pluggable provider hooks activate real Vision AI (`OPENAI_API_KEY` / `AI_GATEWAY_API_KEY`) and Plaid (`PLAID_CLIENT_ID` / `PLAID_SECRET`) when env vars are supplied, while shipping a realistic live-interactive Plaid Sandbox + inbox feed out-of-the-box.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, `@vercel/blob`, `lucide-react`, Node.js 24 native test runner (`node --test`).

## Planned File Structure
1. `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
2. `public/manifest.webmanifest`, `public/sw.js`, `public/icon-192.svg`, `public/icon-512.svg`
3. `src/lib/types.ts` — Shared types for Receipts, LineItems, BankTransactions, BankAccounts, MatchResult, InboxConnection, WorkspaceState, PlanTier.
4. `src/lib/seed.ts` — Realistic seeded workspace (Chase Ink, Mercury Checking, Amex Gold transactions including pending card charges, initial matched & unmatched receipts, Gmail/Outlook sync items).
5. `src/lib/ocr.ts` — Receipt/invoice text & metadata extraction parser (line items, tax, tip, total, merchant, date, card last 4, accounting category) + optional Vision AI adapter.
6. `src/lib/matching.ts` — Two-way bank matching engine (pending & settled charges, tip/settlement tolerance, date window, merchant alias & fuzzy similarity, card last-4 matching, auto-reconcile & missing-receipt detection).
7. `src/lib/inbox.ts` — Gmail/Outlook inbox scraping rules & raw email/EML invoice parser.
8. `src/lib/export.ts` — QuickBooks Online CSV/IIF & Xero bank-statement/bill CSV formatters + audit JSON pack.
9. `src/lib/store.ts` — Workspace persistence layer (`@vercel/blob` private/public store with per-workspace JSON state & uploaded receipt images, plus in-memory fallback).
10. `src/app/api/*` — Route handlers:
    - `/api/health`
    - `/api/workspace` (GET state, POST reset)
    - `/api/receipts` (POST ingest/upload cropped image or sample/manual receipt, DELETE, PATCH category/notes)
    - `/api/plaid/sync` (POST simulate new pending card charge or sync Plaid feed)
    - `/api/reconcile` (POST confirm/manual match or unmatch, run auto-reconcile)
    - `/api/inbox/sync` (POST sync Gmail/Outlook or parse pasted email invoice)
    - `/api/export` (GET QuickBooks CSV / Xero CSV / JSON audit pack download)
    - `/api/billing` (POST switch flat monthly plan \$15 Solo / \$19 Team, cancel-anytime toggle)
11. `src/components/*` & `src/app/page.tsx` — Responsive dashboard + mobile PWA capture modal + auto-crop canvas engine + reconciliation board + switcher pricing drawer.
12. `tests/*.test.ts` — Comprehensive TDD suite using `node --test` covering matching, OCR parsing, inbox parsing, exports, and workspace store transitions.
