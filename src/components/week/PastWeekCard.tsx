'use client';

import { fmt } from '@/utils/format';
import { weekLabel } from '@/utils/week';
import type { WeekSummary } from '@/types';

interface Props {
  week: WeekSummary;
}

/**
 * Read-only summary card for a completed pay week.
 * Shows income, spend, CC payments, net savings, and a progress bar.
 */
export function PastWeekCard({ week }: Props) {
  const savingsColor = week.net_savings >= 0 ? 'text-emerald-500' : 'text-red-500';
  const spentPct     = week.income > 0
    ? Math.min((week.total_expenses / week.income) * 100, 100)
    : 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-3 shadow-sm transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {weekLabel(week.week_start)}
          </p>
          <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            <span>
              Income{' '}
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {fmt(week.income)}
              </span>
            </span>
            <span>
              Spent{' '}
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {fmt(week.total_expenses)}
              </span>
            </span>
            {week.cc_payments > 0 && (
              <span>
                CC{' '}
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {fmt(week.cc_payments)}
                </span>
              </span>
            )}
          </div>
        </div>
        <span className={`text-base font-bold ${savingsColor}`}>
          {fmt(week.net_savings)}
        </span>
      </div>

      {/* Spend progress bar */}
      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 transition-all"
          style={{ width: `${spentPct}%` }}
        />
      </div>
    </div>
  );
}
