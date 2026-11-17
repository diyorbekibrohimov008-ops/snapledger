'use client';

import React, { useState } from 'react';
import { Check, Infinity as InfinityIcon, ShieldCheck, X } from 'lucide-react';
import type { PlanTier, WorkspaceState } from '@/lib/types';

interface PricingAndSwitcherBannerProps {
  workspace: WorkspaceState;
  onUpdateWorkspace: (ws: WorkspaceState, toast?: string) => void;
}

export function PricingAndSwitcherBanner({
  workspace,
  onUpdateWorkspace,
}: PricingAndSwitcherBannerProps) {
  const [updating, setUpdating] = useState(false);

  async function selectPlan(plan: PlanTier) {
    setUpdating(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace: WorkspaceState };
        onUpdateWorkspace(
          data.workspace,
          `Switched to ${plan === 'solo' ? 'Solo $15/mo' : 'Team $19/mo'} — month-to-month, unlimited scans`
        );
      }
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Anti-Metering Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
              <InfinityIcon className="h-3.5 w-3.5" />
              No Document Counters · Month-to-Month
            </div>
            <h3 className="text-lg font-bold text-white">
              {workspace.billing.documentsProcessedThisMonth} / ∞ documents processed this
              month
            </h3>
            <p className="text-xs text-slate-300">
              On WellyBox Basic ($19/mo billed $228/yr upfront), you would already have hit
              the 50-document wall. SnapLedger never meters scans or locks you into annual
              billing.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-right">
            <div className="text-[11px] text-slate-400">Current Plan</div>
            <div className="text-xl font-bold text-white">
              ${workspace.billing.monthlyPriceUsd}
              <span className="text-xs font-normal text-slate-400">/mo</span>
            </div>
            <div className="text-[11px] text-emerald-400">
              Cancel anytime · $0 upfront lock-in
            </div>
          </div>
        </div>
      </div>

      {/* Plan Switcher Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(
          [
            {
              tier: 'solo' as const,
              name: 'Solo Freelancer',
              price: 15,
              desc: 'Everything freelancers need to ditch spreadsheets and annual lock-in.',
              bullets: [
                'Unlimited mobile PWA snaps & email syncs',
                'Read-only Plaid feed (up to 3 bank/card accounts)',
                '3-second auto-crop + line-item OCR',
                'QuickBooks & Xero CSV exports',
              ],
            },
            {
              tier: 'team' as const,
              name: 'Growing SMB Team',
              price: 19,
              desc: 'Multi-card reconciliation & direct QuickBooks/Xero bookkeeping for teams.',
              bullets: [
                'Unlimited scans, receipts & multi-inbox Gmail/Outlook',
                'Unlimited Plaid corporate cards & team members',
                'Priority pending-charge tip & settlement matching',
                'Direct QuickBooks Online & Xero auto-sync',
              ],
            },
          ] as const
        ).map((card) => {
          const active = workspace.billing.plan === card.tier;
          return (
            <div
              key={card.tier}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                active
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white">{card.name}</h4>
                  {active && (
                    <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-slate-950">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">${card.price}</span>
                  <span className="text-xs text-slate-400">
                    /month · no annual contract
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{card.desc}</p>
                <ul className="mt-4 space-y-2 text-xs text-slate-200">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={active || updating}
                onClick={() => selectPlan(card.tier)}
                className={`mt-5 w-full rounded-xl py-2.5 text-xs font-semibold transition ${
                  active
                    ? 'cursor-default border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'bg-white text-slate-950 hover:bg-slate-200'
                }`}
              >
                {active ? 'Current Monthly Plan' : `Switch to $${card.price}/mo`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Competitor Comparison Matrix */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-white">
            Why Switchers Leave WellyBox &amp; SparkReceipt
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Capability</th>
                <th className="px-5 py-3 font-semibold text-emerald-400">SnapLedger</th>
                <th className="px-5 py-3 font-medium">WellyBox</th>
                <th className="px-5 py-3 font-medium">SparkReceipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr>
                <td className="px-5 py-3 font-medium text-white">Monthly Document Cap</td>
                <td className="px-5 py-3 font-semibold text-emerald-300">Unlimited (∞)</td>
                <td className="px-5 py-3 text-rose-300">50 docs / month cap</td>
                <td className="px-5 py-3 text-slate-400">Tiered limits</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-white">Billing Flexibility</td>
                <td className="px-5 py-3 font-semibold text-emerald-300">
                  $15–$19/mo month-to-month
                </td>
                <td className="px-5 py-3 text-rose-300">$228 upfront annual lock-in</td>
                <td className="px-5 py-3 text-slate-400">Annual discount push</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-white">Paper Receipt Capture</td>
                <td className="px-5 py-3 font-semibold text-emerald-300">
                  3-sec Mobile PWA + Auto-Crop
                </td>
                <td className="px-5 py-3 text-rose-300">WhatsApp bot (misreads slips)</td>
                <td className="px-5 py-3 text-slate-400">Native app install</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-white">Bank Reconciliation</td>
                <td className="px-5 py-3 font-semibold text-emerald-300">
                  Two-Way Plaid Pending &amp; Posted Match
                </td>
                <td className="px-5 py-3 text-slate-400">
                  <span className="inline-flex items-center gap-1 text-rose-300">
                    <X className="h-3.5 w-3.5" /> Isolated receipt folder
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-400">Manual statement upload</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
