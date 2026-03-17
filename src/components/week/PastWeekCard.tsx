'use client';

import { useState } from 'react';
import { fmt } from '@/utils/format';
import { weekLabel } from '@/utils/week';
import type { WeekSummary } from '@/types';

interface Props {
  week: WeekSummary;
  onClose?: () => void;
}

export function PastWeekCard({ week, onClose }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [closing,   setClosing]   = useState(false);
  const [error,     setError]     = useState('');

  const savingsColor = week.net_savings >= 0 ? 'text-emerald-500' : 'text-red-500';
  const spentPct     = week.income > 0
    ? Math.min((week.total_expenses / week.income) * 100, 100)
    : 0;

  async function confirmClose() {
    setClosing(true);
    setError('');
    try {
      const res = await fetch('/api/rollup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: week.week_start }),
      });
      if (res.ok) {
        setShowModal(false);
        onClose?.();
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to close week');
      }
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-3 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {weekLabel(week.week_start)}
              </p>
              {week.is_closed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-medium">
                  closed
                </span>
              )}
            </div>
            <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              <span>
                Income{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">{fmt(week.income)}</span>
              </span>
              <span>
                Spent{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">{fmt(week.total_expenses)}</span>
              </span>
              {week.cc_payments > 0 && (
                <span>
                  CC{' '}
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">{fmt(week.cc_payments)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!week.is_closed && (
              <button
                onClick={() => setShowModal(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-red-300 hover:text-red-500 dark:hover:border-red-700 dark:hover:text-red-400 transition-colors"
              >
                Close week
              </button>
            )}
            <span className={`text-base font-bold ${savingsColor}`}>
              {fmt(week.net_savings)}
            </span>
          </div>
        </div>

        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 transition-all"
            style={{ width: `${spentPct}%` }}
          />
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between mb-1">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-3">
                Close week?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">{weekLabel(week.week_start)}</span>
                {' '}will be rolled up into a summary. Individual expense rows for this week will be permanently deleted.
              </p>
            </div>

            {/* Summary preview */}
            <div className="mx-6 mb-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 divide-y divide-gray-100 dark:divide-gray-700/60">
              <Row label="Income"    value={fmt(week.income)}         color="text-blue-500" />
              <Row label="Expenses"  value={fmt(week.total_expenses)} color="text-orange-500" />
              {week.cc_payments > 0 && (
                <Row label="CC Payments" value={fmt(week.cc_payments)} color="text-purple-500" />
              )}
              <Row
                label="Net savings"
                value={fmt(week.net_savings)}
                color={week.net_savings >= 0 ? 'text-emerald-500' : 'text-red-500'}
              />
            </div>

            {error && (
              <p className="mx-6 mb-3 text-xs text-red-500">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={closing}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmClose}
                disabled={closing}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium text-white disabled:opacity-40 transition-colors"
              >
                {closing ? 'Closing…' : 'Yes, close week'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
