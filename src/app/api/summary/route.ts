import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fridayOf } from '@/utils/week';
import type { WeekSummary } from '@/types';

export const runtime = 'nodejs';

/**
 * GET /api/summary
 *
 * Aggregates all income and expense rows, groups them by Friday-start pay week,
 * and returns one WeekSummary per week sorted newest first.
 *
 * CC Payment rows (is_transfer = 1) are counted separately and excluded from
 * total_expenses so they don't inflate the net savings calculation.
 */
export async function GET() {
  try {
    const db = await getDb();

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
      if (!map.has(friday)) {
        map.set(friday, {
          week_start:     friday,
          income:         0,
          total_expenses: 0,
          cc_payments:    0,
          net_savings:    0,
        });
      }
      return map.get(friday)!;
    }

    for (const row of incomeRows.rows) {
      const week = ensure(fridayOf(row.date as string));
      week.income += Number(row.amount);
    }

    for (const row of expenseRows.rows) {
      const week = ensure(fridayOf(row.date as string));
      if (Number(row.is_transfer) === 1) {
        week.cc_payments += Number(row.amount);
      } else {
        week.total_expenses += Number(row.amount);
      }
    }

    const summaries = Array.from(map.values())
      .map((w) => ({ ...w, net_savings: w.income - w.total_expenses }))
      .sort((a, b) => b.week_start.localeCompare(a.week_start));

    return NextResponse.json(summaries);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
