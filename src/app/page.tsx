'use client';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { WeekEntryCard } from '@/components/week/WeekEntryCard';
import { PastWeekCard } from '@/components/week/PastWeekCard';
import { useWeekData } from '@/hooks/useWeekData';
import { fmt } from '@/utils/format';
import { fridayOf, todayISO } from '@/utils/week';

const currentWeekStart = fridayOf(todayISO());

export default function Home() {
  const { weeks, categories, methods, loading } = useWeekData();

  // Ensure the current week always has a card, even before data is entered
  const allWeeks = (() => {
    if (loading) return [];
    const exists = weeks.some((w) => w.week_start === currentWeekStart);
    if (exists) return weeks;
    return [
      { week_start: currentWeekStart, income: 0, total_expenses: 0, cc_payments: 0, net_savings: 0 },
      ...weeks,
    ];
  })();

  const currentWeek = allWeeks.find((w) => w.week_start === currentWeekStart);
  const pastWeeks   = allWeeks.filter((w) => w.week_start !== currentWeekStart);
  const totalSaved  = weeks.reduce((sum, w) => sum + w.net_savings, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-xl mx-auto px-4 py-10 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Finance Tracker
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Weekly · Friday → Thursday
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <div className="text-right">
                <p className={`text-lg font-bold ${totalSaved >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {fmt(totalSaved)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">all-time saved</p>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>
        ) : (
          <>
            {currentWeek && (
              <WeekEntryCard
                week={currentWeek}
                categories={categories}
                methods={methods}
                isCurrentWeek
              />
            )}

            {pastWeeks.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 px-1">
                  Past Weeks
                </p>
                {pastWeeks.map((w) => (
                  <PastWeekCard key={w.week_start} week={w} />
                ))}
              </section>
            )}
          </>
        )}

      </div>
    </div>
  );
}
