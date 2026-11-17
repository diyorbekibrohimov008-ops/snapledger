'use client';

import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Mail,
  RotateCcw,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { CameraCaptureModal } from '@/components/CameraCaptureModal';
import { InboxAndAccountingPanel } from '@/components/InboxAndAccountingPanel';
import { PricingAndSwitcherBanner } from '@/components/PricingAndSwitcherBanner';
import { ReconciliationBoard } from '@/components/ReconciliationBoard';
import type { WorkspaceState } from '@/lib/types';

type TabKey = 'reconcile' | 'inbox' | 'pricing';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function HomePage() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('reconcile');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    fetchWorkspace();
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function fetchWorkspace() {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as WorkspaceState;
        setWorkspace(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleUpdateWorkspace(next: WorkspaceState, message?: string) {
    setWorkspace(next);
    if (message) {
      setToast(message);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleResetDemo() {
    const res = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    if (res.ok) {
      const fresh = (await res.json()) as WorkspaceState;
      handleUpdateWorkspace(fresh, 'Demo workspace reset cleanly');
    }
  }

  async function triggerInstallPwa() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (loading || !workspace) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b14]">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm font-medium">Loading SnapLedger Plaid &amp; Receipt Feed...</p>
        </div>
      </main>
    );
  }

  const reconciledCount = workspace.transactions.filter(
    (t) => t.status === 'reconciled'
  ).length;
  const missingCount = workspace.transactions.filter(
    (t) => t.status === 'missing_receipt'
  ).length;
  const pendingMatchedCount = workspace.transactions.filter(
    (t) => t.pending && t.status === 'reconciled'
  ).length;
  const matchRate =
    workspace.transactions.length > 0
      ? Math.round((reconciledCount / workspace.transactions.length) * 100)
      : 100;

  return (
    <div className="min-h-screen bg-[#070b14] pb-24 sm:pb-10">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  SnapLedger
                </span>
                <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 sm:inline-block">
                  No Doc Caps · ${workspace.billing.monthlyPriceUsd}/mo
                </span>
              </div>
              <p className="text-xs text-slate-400">{workspace.businessName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {installPrompt && (
              <button
                type="button"
                onClick={triggerInstallPwa}
                className="hidden items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 sm:inline-flex"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                Install PWA
              </button>
            )}

            <button
              type="button"
              onClick={handleResetDemo}
              title="Reset workspace demo data"
              aria-label="Reset workspace demo data"
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 transition hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 sm:text-sm"
            >
              <Camera className="h-4 w-4" />
              <span>Snap Receipt (3s)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed right-4 top-16 z-40 max-w-sm rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6">
        {/* Hero KPI Row */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>2-Way Plaid Match Rate</span>
              <CreditCard className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white tabular-nums">{matchRate}%</div>
            <div className="mt-1 text-[11px] text-emerald-400">
              {reconciledCount} of {workspace.transactions.length} card charges paired
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Pending Charges Paired</span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white tabular-nums">
              {pendingMatchedCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Matched before settlement clears
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Missing Receipts</span>
              <Layers className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white tabular-nums">{missingCount}</div>
            <div className="mt-1 text-[11px] text-rose-300">
              {missingCount === 0
                ? 'Books 100% audit-ready'
                : 'Tap Snap (3s) to attach slip'}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between text-xs text-emerald-300">
              <span>Monthly Scans Used</span>
              <InfinityIcon className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white tabular-nums">
              {workspace.billing.documentsProcessedThisMonth}{' '}
              <span className="text-base font-medium text-emerald-300">/ ∞</span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-300">
              Passed WellyBox&apos;s 50-doc limit with $0 extra
            </div>
          </div>
        </section>

        {/* Desktop Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-3">
          {(
            [
              { id: 'reconcile' as const, label: 'Two-Way Bank Reconciliation', icon: CreditCard },
              { id: 'inbox' as const, label: 'Inbox Scraper & Exports', icon: Mail },
              { id: 'pricing' as const, label: 'Unlimited Plan ($15–$19/mo)', icon: InfinityIcon },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? 'bg-white text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab Views */}
        {activeTab === 'reconcile' && (
          <ReconciliationBoard
            workspace={workspace}
            onUpdateWorkspace={handleUpdateWorkspace}
            onOpenCamera={() => setCameraOpen(true)}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxAndAccountingPanel
            workspace={workspace}
            onUpdateWorkspace={handleUpdateWorkspace}
          />
        )}

        {activeTab === 'pricing' && (
          <PricingAndSwitcherBanner
            workspace={workspace}
            onUpdateWorkspace={handleUpdateWorkspace}
          />
        )}
      </main>

      {/* Mobile PWA Bottom Bar */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-4 pt-2 backdrop-blur sm:hidden">
        <div className="flex items-center justify-around">
          <button
            type="button"
            onClick={() => setActiveTab('reconcile')}
            className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] ${
              activeTab === 'reconcile' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            Bank Match
          </button>

          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/30"
            aria-label="Snap Receipt"
          >
            <Camera className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] ${
              activeTab === 'inbox' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <Download className="h-5 w-5" />
            Inbox/Export
          </button>
        </div>
      </div>

      {/* 3-Second Mobile Camera Capture Modal */}
      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={handleUpdateWorkspace}
      />
    </div>
  );
}
