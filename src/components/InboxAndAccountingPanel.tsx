'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { WorkspaceState } from '@/lib/types';

interface InboxAndAccountingPanelProps {
  workspace: WorkspaceState;
  onUpdateWorkspace: (ws: WorkspaceState, toast?: string) => void;
}

const SAMPLE_FORWARD_EMAIL = `From: billing@figma.com
Subject: Your Figma invoice for November 2026
Date: 2026-11-11

Figma Organization
Design Seats (3 x $15.00)    $45.00
Sales Tax                     $0.00
Total Charged: $45.00
Paid with Amex ending in 1008`;

export function InboxAndAccountingPanel({
  workspace,
  onUpdateWorkspace,
}: InboxAndAccountingPanelProps) {
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [parsingEmail, setParsingEmail] = useState(false);
  const [emailRaw, setEmailRaw] = useState(SAMPLE_FORWARD_EMAIL);
  const [copiedForward, setCopiedForward] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);

  async function handleSyncInboxes() {
    setSyncingInbox(true);
    try {
      const res = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sync' }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          addedCount: number;
          workspace: WorkspaceState;
        };
        onUpdateWorkspace(
          data.workspace,
          data.addedCount > 0
            ? `Scraped ${data.addedCount} new invoices from Gmail & Outlook`
            : 'Gmail & Outlook inboxes already up to date'
        );
      }
    } finally {
      setSyncingInbox(false);
    }
  }

  async function handleParseEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailRaw.trim()) return;
    setParsingEmail(true);
    try {
      const res = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'parse',
          emailRaw,
          source: 'forward_email',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          workspace: WorkspaceState;
          addedReceipts?: Array<{ merchant: string; totalCents: number }>;
        };
        const first = data.addedReceipts?.[0];
        onUpdateWorkspace(
          data.workspace,
          first
            ? `Extracted ${first.merchant} ($${(first.totalCents / 100).toFixed(2)}) from email`
            : 'Email invoice parsed'
        );
      }
    } finally {
      setParsingEmail(false);
    }
  }

  async function toggleAccounting(provider: 'quickbooks' | 'xero') {
    setTogglingProvider(provider);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleAccounting: provider }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace: WorkspaceState };
        onUpdateWorkspace(data.workspace, `Updated ${provider.toUpperCase()} sync settings`);
      }
    } finally {
      setTogglingProvider(null);
    }
  }

  function copyForwardAddress() {
    navigator.clipboard?.writeText(workspace.forwardingAddress).catch(() => undefined);
    setCopiedForward(true);
    setTimeout(() => setCopiedForward(false), 1800);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Left: Gmail & Outlook Inbox Sync */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Gmail &amp; Outlook Inbox Scraper
              </h3>
              <p className="text-xs text-slate-400">
                Pulls vendor invoices &amp; PDFs automatically without document caps
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncInboxes}
            disabled={syncingInbox}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingInbox ? 'animate-spin' : ''}`} />
            {syncingInbox ? 'Scraping…' : 'Sync Inboxes Now'}
          </button>
        </div>

        <div className="space-y-2.5">
          {workspace.inboxes.map((inb) => (
            <div
              key={inb.id}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sky-400" />
                  <span className="text-sm font-medium text-white">{inb.email}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                    {inb.provider}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {inb.syncedCount} docs synced
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inb.rules.map((rule) => (
                  <span
                    key={rule}
                    className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400"
                  >
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Dedicated Forwarding Alias */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="text-xs font-medium text-slate-300">
            Instant Email Forwarding Alias
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <code className="truncate text-xs text-emerald-300">
              {workspace.forwardingAddress}
            </code>
            <button
              type="button"
              onClick={copyForwardAddress}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
            >
              <Copy className="h-3 w-3" />
              {copiedForward ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Live Email Parser */}
        <form onSubmit={handleParseEmail} className="space-y-2.5 border-t border-slate-800 pt-3">
          <label className="block text-xs font-medium text-slate-300">
            Test Forwarded Email Invoice Parser
          </label>
          <textarea
            rows={5}
            value={emailRaw}
            onChange={(e) => setEmailRaw(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={parsingEmail || !emailRaw.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25 disabled:opacity-50"
          >
            {parsingEmail ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Extract Email Invoice &amp; Reconcile
          </button>
        </form>
      </section>

      {/* Right: QuickBooks Online & Xero Export */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              QuickBooks Online &amp; Xero Sync
            </h3>
            <p className="text-xs text-slate-400">
              Export reconciled line items with Plaid transaction IDs &amp; GL codes
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {workspace.accounting.map((acc) => (
            <div
              key={acc.provider}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold capitalize text-white">
                    {acc.provider === 'quickbooks' ? 'QuickBooks Online' : 'Xero'}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      acc.connected
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {acc.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{acc.companyName}</div>
              </div>
              <button
                type="button"
                onClick={() => toggleAccounting(acc.provider)}
                disabled={togglingProvider === acc.provider}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  acc.connected
                    ? 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {acc.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-3 text-xs font-medium text-slate-300">
            Download Accountant-Ready Exports (Includes Matched Plaid IDs)
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <a
              href="/api/export?format=quickbooks"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <Download className="h-3.5 w-3.5" />
              QuickBooks CSV
            </a>
            <a
              href="/api/export?format=xero"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:border-emerald-500/50 hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              Xero Bank CSV
            </a>
            <a
              href="/api/export?format=json"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              JSON Audit Pack
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
