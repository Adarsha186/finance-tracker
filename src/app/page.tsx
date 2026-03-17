'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { WeekEntryCard } from '@/components/week/WeekEntryCard';
import { PastWeekCard } from '@/components/week/PastWeekCard';
import { AnalysisTab } from '@/components/analysis/AnalysisTab';
import { SettingsTab } from '@/components/settings/SettingsTab';
import { useWeekData } from '@/hooks/useWeekData';
import { fridayOf, todayISO } from '@/utils/week';

const currentWeekStart = fridayOf(todayISO());

type Tab = 'weekly' | 'analysis' | 'settings';

export default function Home() {
  const { weeks, categories, methods, loading, reload } = useWeekData();
  const [tab,   setTab]   = useState<Tab>('weekly');
  const [start, setStart] = useState('');
  const [end,   setEnd]   = useState(todayISO());

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 h-14 grid grid-cols-3 items-center">

          {/* Left: brand */}
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Finance Tracker
          </span>

          {/* Center: nav links */}
          <div className="flex items-center justify-center gap-1">
            {([
              { id: 'weekly',   label: 'Weekly'   },
              { id: 'analysis', label: 'Analysis' },
              { id: 'settings', label: 'Settings' },
            ] as { id: Tab; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right: theme toggle */}
          <div className="flex justify-end">
            <ThemeToggle />
          </div>

        </div>
      </nav>

      {/* ── Page content ── */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Weekly tab ── */}
        {tab === 'weekly' && (
          loading ? (
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
                    <PastWeekCard key={w.week_start} week={w} onClose={reload} />
                  ))}
                </section>
              )}
            </>
          )
        )}

        {/* ── Analysis tab ── */}
        {tab === 'analysis' && <AnalysisTab start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />}

        {/* ── Settings tab ── */}
        {tab === 'settings' && <SettingsTab />}

      </div>
    </div>
  );
}
