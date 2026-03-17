import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fridayOf } from '@/utils/week';
import type { WeekSummary } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();

    // ── Closed weeks from week_summaries ──────────────────────────────────────
    const closedRows = await db.execute(
      'SELECT week_start, income, total_expenses, cc_payments, net_savings FROM week_summaries'
    );
    const closedWeekStarts = new Set(closedRows.rows.map((r) => r.week_start as string));

    const closed: WeekSummary[] = closedRows.rows.map((r) => ({
      week_start:     r.week_start     as string,
      income:         Number(r.income),
      total_expenses: Number(r.total_expenses),
      cc_payments:    Number(r.cc_payments),
      net_savings:    Number(r.net_savings),
      is_closed:      true,
    }));

    // ── Open weeks from live income + expenses ────────────────────────────────
    const [incomeRows, expenseRows] = await Promise.all([
      db.execute('SELECT amount, date FROM income ORDER BY date'),
      db.execute(`
        SELECT e.amount, e.date, c.is_transfer
        FROM expenses e
        JOIN categories c ON c.id = e.category_id
      `),
    ]);

    const map = new Map<string, WeekSummary>();

    function ensure(friday: string): WeekSummary {
      if (closedWeekStarts.has(friday)) return null!; // skip closed weeks
      if (!map.has(friday)) {
        map.set(friday, {
          week_start:     friday,
          income:         0,
          total_expenses: 0,
          cc_payments:    0,
          net_savings:    0,
          is_closed:      false,
        });
      }
      return map.get(friday)!;
    }

    for (const row of incomeRows.rows) {
      const week = ensure(fridayOf(row.date as string));
      if (week) week.income += Number(row.amount);
    }

    for (const row of expenseRows.rows) {
      const week = ensure(fridayOf(row.date as string));
      if (!week) continue;
      if (Number(row.is_transfer) === 1) {
        week.cc_payments += Number(row.amount);
      } else {
        week.total_expenses += Number(row.amount);
      }
    }

    const open = Array.from(map.values()).map((w) => ({
      ...w,
      net_savings: w.income - w.total_expenses - w.cc_payments,
    }));

    const summaries = [...closed, ...open].sort((a, b) =>
      b.week_start.localeCompare(a.week_start)
    );

    return NextResponse.json(summaries);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
