'use client';

import { useState, useEffect, useCallback } from 'react';
import { fmt } from '@/utils/format';
import { todayISO } from '@/utils/week';
import { inputCls } from '@/styles/inputs';
import type { AnalysisResult } from '@/app/api/analysis/route';

interface Props {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange:   (v: string) => void;
}

export function AnalysisTab({ start, end, onStartChange, onEndChange }: Props) {
  const today = todayISO();

  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end)   params.set('end',   end);
      const res = await fetch(`/api/analysis?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch {
      setError('Failed to load analysis data.');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  const savingsColor = !data
    ? 'text-gray-500'
    : data.net_savings >= 0
      ? 'text-emerald-500'
      : 'text-red-500';

  return (
    <div className="space-y-6">

      {/* ── Date range picker ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Date Range
        </p>
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={start}
              max={end || today}
              onChange={(e) => onStartChange(e.target.value)}
              className={inputCls}
              placeholder="All time"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={end}
              min={start || undefined}
              max={today}
              onChange={(e) => onEndChange(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        {!start && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No start date = all-time data
          </p>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : data ? (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Income"   value={fmt(data.income)}         color="text-blue-500" />
            <StatCard label="Total Expenses" value={fmt(data.total_expenses)} color="text-orange-500" />
            {data.cc_payments > 0 && (
              <StatCard label="Transfers" value={fmt(data.cc_payments)} color="text-purple-500" />
            )}
            <StatCard label="Net Savings" value={fmt(data.net_savings)} color={savingsColor} />
          </div>

          {/* ── Category breakdown ── */}
          {data.by_category.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                By Category
              </p>
              <div className="space-y-2">
                {data.by_category.map((cat) => {
                  const pct = data.total_expenses > 0
                    ? Math.round((cat.total / data.total_expenses) * 100)
                    : 0;
                  return (
                    <div key={cat.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {fmt(cat.total)}
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                            {pct}%
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-1.5 rounded-full bg-orange-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Payment method breakdown ── */}
          {data.by_payment_method.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                By Payment Method
              </p>
              <div className="space-y-2">
                {data.by_payment_method.map((pm) => (
                  <div key={pm.name} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        pm.type === 'credit'
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      }`}>
                        {pm.type}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">{pm.name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {fmt(pm.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.by_category.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              No expenses found for this period.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
