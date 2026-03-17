import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fridayOf, todayISO } from '@/utils/week';

export const runtime = 'nodejs';

/**
 * POST /api/rollup
 * body: { week_start: string }
 *
 * Aggregates all income + expenses for the given week into week_summaries,
 * then deletes the individual expense rows for that week.
 * Income rows are kept (one per week, very lightweight).
 */
export async function POST(request: Request) {
  try {
    const { week_start } = await request.json();
    if (!week_start) {
      return NextResponse.json({ error: 'week_start is required' }, { status: 400 });
    }

    // Prevent closing the current week
    const currentWeekStart = fridayOf(todayISO());
    if (week_start === currentWeekStart) {
      return NextResponse.json({ error: 'Cannot close the current week' }, { status: 400 });
    }

    const db = await getDb();

    // Check not already closed
    const already = await db.execute({
      sql: 'SELECT week_start FROM week_summaries WHERE week_start = ?',
      args: [week_start],
    });
    if (already.rows.length > 0) {
      return NextResponse.json({ error: 'Week is already closed' }, { status: 409 });
    }

    // ── Aggregate income ──────────────────────────────────────────────────────
    const incomeRows = await db.execute({
      sql: `SELECT COALESCE(SUM(amount), 0) AS total FROM income WHERE date >= ? AND date <= ?`,
      args: [week_start, thursdayOf(week_start)],
    });
    const income = Number(incomeRows.rows[0]?.total ?? 0);

    // ── Aggregate expenses by category ────────────────────────────────────────
    const catRows = await db.execute({
      sql: `SELECT c.name, c.is_transfer, COALESCE(SUM(e.amount), 0) AS total
            FROM expenses e
            JOIN categories c ON c.id = e.category_id
            WHERE e.date >= ? AND e.date <= ?
            GROUP BY c.id, c.name, c.is_transfer
            ORDER BY total DESC`,
      args: [week_start, thursdayOf(week_start)],
    });

    let total_expenses = 0;
    let cc_payments    = 0;
    const category_breakdown: { name: string; total: number }[] = [];

    for (const row of catRows.rows) {
      const amt = Number(row.total);
      if (Number(row.is_transfer) === 1) {
        cc_payments += amt;
      } else {
        total_expenses += amt;
        category_breakdown.push({ name: row.name as string, total: amt });
      }
    }

    // ── Aggregate expenses by payment method ──────────────────────────────────
    const pmRows = await db.execute({
      sql: `SELECT pm.name, pm.type, COALESCE(SUM(e.amount), 0) AS total
            FROM expenses e
            JOIN payment_methods pm ON pm.id = e.payment_method_id
            JOIN categories c ON c.id = e.category_id
            WHERE e.date >= ? AND e.date <= ?
              AND c.is_transfer = 0
            GROUP BY pm.id, pm.name, pm.type
            ORDER BY total DESC`,
      args: [week_start, thursdayOf(week_start)],
    });

    const payment_method_breakdown = pmRows.rows.map((r) => ({
      name:  r.name  as string,
      type:  r.type  as string,
      total: Number(r.total),
    }));

    const net_savings = income - total_expenses - cc_payments;

    // ── Write summary + delete expenses (atomic batch) ────────────────────────
    await db.batch([
      {
        sql: `INSERT INTO week_summaries
                (week_start, income, total_expenses, cc_payments, net_savings,
                 category_breakdown, payment_method_breakdown)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          week_start,
          income,
          total_expenses,
          cc_payments,
          net_savings,
          JSON.stringify(category_breakdown),
          JSON.stringify(payment_method_breakdown),
        ],
      },
      {
        sql: `DELETE FROM expenses WHERE date >= ? AND date <= ?`,
        args: [week_start, thursdayOf(week_start)],
      },
    ], 'write');

    return NextResponse.json({ ok: true, week_start, income, total_expenses, cc_payments, net_savings });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to close week' }, { status: 500 });
  }
}

/** Returns the Thursday (end of pay week) for a given Friday week_start. */
function thursdayOf(friday: string): string {
  const d = new Date(friday + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}
