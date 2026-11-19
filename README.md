# SnapLedger 🧾⚡

> **Unlimited Receipt & Invoice Bookkeeping with 3-Second Mobile Camera Auto-Crop and Two-Way Plaid Bank Matching.**

> [!WARNING]
> **Project Status — Work in Progress (Not Fully Ready)**
> This project is currently under active development and is **not fully ready for production**. Some parts, features, or workflow steps will fail or behave unexpectedly. We are actively working on fixing all remaining issues.

[![Live Production](https://img.shields.io/badge/Vercel-Live%20Production-000?style=flat&logo=vercel)](https://snapledger-bookkeeping.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react)](https://react.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Tests Passing](https://img.shields.io/badge/Tests-12%2F12%20Passing-brightgreen?style=flat)](./tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Overview & Value Proposition

Existing bookkeeping tools like **WellyBox** and **SparkReceipt** aggressively meter users and push upfront annual lock-ins:
- **WellyBox** charges minimum **$228/year upfront** while strictly capping Basic users at **50 documents/month**.
- Physical paper receipt capture relies on clunky WhatsApp bots that misread faded thermal slips and isolate images in disconnected folders without bank context.

**SnapLedger solves this with three pillars:**

1. **No Document Counters & Flat Monthly Pricing:** Month-to-month billing at **$15/mo (Solo)** or **$19/mo (Team)** with **unlimited (`∞`) scans**, zero upfront annual lock-in, and no arbitrary document caps.
2. **Two-Way Plaid Bank Reconciliation:** Reconciles receipts directly against live bank/card feeds (posted and **pending** transactions). The scoring engine handles pre-tip auth variances, merchant descriptor aliases (e.g., `SQ *BLUE BOTTLE COFEE SF` ➔ `Blue Bottle Coffee`), settlement date windows, and card `last4` tie-breakers.
3. **3-Second Mobile Camera PWA:** Zero-install Progressive Web App (`manifest.webmanifest`, `sw.js`) with client-side Canvas edge detection, automatic paper cropping, thermal contrast enhancement, and 1-click sample receipts.

---

## 🚀 Key Features

- **📸 3-Second Camera Auto-Crop:** Pure client-side Canvas pixel-luminance edge detector (`src/lib/canvas-crop.ts`) extracts receipt slips from darker backdrops (e.g., wooden desks) in sub-second time.
- **🏦 Two-Way Bank Matching Engine:** Multi-factor scoring across amount, date, merchant similarity (token Jaccard + bigram Dice), card mask, and pending pre-tip authorization tolerances (`src/lib/matching.ts`).
- **🔍 Line-Item OCR:** Deterministic parser extracts merchant, date, tax, tip, total, and line items, with a pluggable `OPENAI_API_KEY` Vision AI fallback (`src/lib/ocr.ts`).
- **📬 Multi-Inbox Scraper:** Automated ingestion rules for Gmail and Outlook, plus a dedicated email forwarding parser for invoices (`src/lib/inbox.ts`).
- **📊 1-Click Accounting Exports:** Instant accountant-ready CSVs formatted for QuickBooks Online, Xero, and full JSON audit packs (`src/lib/export.ts`).
- **💾 Dual-Mode Persistence:** Backed by private `@vercel/blob` storage with automatic in-memory write-through fallback (`src/lib/store.ts`).
- **🛡️ Production Security Headers:** Full Content-Security-Policy, HSTS, X-Frame-Options (`DENY`), and Permissions-Policy configured via `vercel.json`.

---

## 🏗️ Architecture & Project Structure

```
snapledger/
├── public/
│   ├── icon-192.svg            # PWA maskable icon
│   ├── icon-512.svg            # PWA splash icon
│   ├── manifest.webmanifest    # Web app manifest
│   └── sw.js                   # Service Worker cache
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── billing/        # Plan upgrade/downgrade ($15/$19)
│   │   │   ├── export/         # QuickBooks & Xero CSV downloads
│   │   │   ├── health/         # System & storage health check
│   │   │   ├── inbox/sync/     # Gmail/Outlook email scraper
│   │   │   ├── plaid/sync/     # Plaid feed sync & card swipe simulation
│   │   │   ├── receipts/       # OCR ingestion & receipt management
│   │   │   ├── receipts/[id]/image/ # Authenticated Blob image serving
│   │   │   ├── reconcile/      # 2-way manual & auto pairing
│   │   │   └── workspace/      # Workspace state CRUD
│   │   ├── globals.css         # Tailwind CSS v4 styling
│   │   ├── layout.tsx          # Root layout & PWA metadata
│   │   └── page.tsx            # Main SnapLedger dashboard
│   ├── components/
│   │   ├── CameraCaptureModal.tsx        # Camera viewfinder & auto-crop
│   │   ├── InboxAndAccountingPanel.tsx   # Inbox scraper & export center
│   │   ├── PricingAndSwitcherBanner.tsx  # Competitor comparison & plans
│   │   ├── PwaRegistrar.tsx              # Service worker registration
│   │   └── ReconciliationBoard.tsx       # Plaid vs Receipt 2-way board
│   └── lib/
│       ├── canvas-crop.ts      # Edge detection & thermal contrast
│       ├── export.ts           # QuickBooks & Xero CSV formatters
│       ├── inbox.ts            # Forwarded invoice email parser
│       ├── matching.ts         # Two-way Plaid matching engine
│       ├── ocr.ts              # Line-item OCR parser & Vision hook
│       ├── seed.ts             # Default workspace demo state
│       ├── store.ts            # Vercel Blob & memory store
│       ├── types.ts            # TypeScript interfaces
│       └── workspace-cookie.ts # Session cookie management
├── tests/
│   ├── crop.test.ts            # Canvas edge detection unit tests
│   ├── inbox-export.test.ts    # Email parser & accounting export tests
│   ├── matching.test.ts        # Bank matching & tip variance tests
│   ├── ocr.test.ts             # OCR parsing & line items tests
│   └── store.test.ts           # End-to-end workspace state tests
├── vercel.json                 # Security headers & CSP
└── package.json
```

---

## 🧪 Testing

The test suite runs with Node's native test runner (`node --test`), verifying all core algorithms without external mocks:

```bash
npm test
```

### Test Coverage Highlights:
- **`tests/matching.test.ts`**: Verifies merchant normalization, descriptor stripping (`SQ *`, `TST*`), pre-tip auth variances, card mask tie-breakers, and symmetric pair/unpair.
- **`tests/ocr.test.ts`**: Validates deterministic thermal receipt parsing, tax/tip calculation, and expense category classification.
- **`tests/crop.test.ts`**: Tests pixel-buffer boundary detection of paper receipts on dark desk backgrounds.
- **`tests/inbox-export.test.ts`**: Validates email invoice header extraction and QuickBooks/Xero CSV schema alignment.
- **`tests/store.test.ts`**: Verifies receipt ingestion, auto-reconciliation, and unlimited document counter enforcement.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 22+ (tested on Node.js 24)
- npm 10+

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/diyorbekibrohimov008-ops/snapledger.git
   cd snapledger
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables (optional):**
   ```bash
   cp .env.example .env.local
   ```
   *Note: SnapLedger operates fully in demo sandbox mode out of the box with zero external API keys required.*

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🚢 Deployment

SnapLedger is optimized for zero-config deployment on **Vercel**:

```bash
npx vercel deploy --prod
```

### Production Environment Variables:
| Variable | Description | Default / Fallback |
| :--- | :--- | :--- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token for private image/state storage | In-memory write-through store |
| `OPENAI_API_KEY` | Optional OpenAI key for GPT-4o-mini Vision OCR hook | Deterministic regex/pattern OCR |
| `PLAID_CLIENT_ID` | Optional Plaid API client ID | Mock sandbox card feed |
| `PLAID_SECRET` | Optional Plaid API secret | Mock sandbox card feed |

---

## 📄 License

MIT License. Free for personal and commercial use.
