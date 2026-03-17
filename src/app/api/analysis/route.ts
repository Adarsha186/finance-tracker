import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export interface AnalysisResult {
  income: number;
  total_expenses: number;
  cc_payments: number;
  net_savings: number;
  by_category: { name: string; total: number }[];
  by_payment_method: { name: string; type: string; total: number }[];
}

/**
 * GET /api/analysis?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Merges data from closed weeks (week_summaries) and live expenses,
 * filtered by the given date range.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end   = searchParams.get('end');

    const db = await getDb();

    // ── Closed weeks ──────────────────────────────────────────────────────────
    const closedRows = await db.execute(
      'SELECT week_start, income, total_expenses, cc_payments, net_savings, category_breakdown, payment_method_breakdown FROM week_summaries'
    );

    let closedIncome    = 0;
    let closedExpenses  = 0;
    let closedCC        = 0;
    const closedWeekStarts = new Set<string>();
    const catMap  = new Map<string, number>();
    const pmMap   = new Map<string, { type: string; total: number }>();

    for (const row of closedRows.rows) {
      const ws = row.week_start as string;

      // Filter by date range using week_start
      if (start && ws < start) continue;
      if (end   && ws > end)   continue;

      closedWeekStarts.add(ws);
      closedIncome   += Number(row.income);
      closedExpenses += Number(row.total_expenses);
      closedCC       += Number(row.cc_payments);

      const cats: { name: string; total: number }[]                  = JSON.parse(row.category_breakdown as string ?? '[]');
      const pms:  { name: string; type: string; total: number }[]    = JSON.parse(row.payment_method_breakdown as string ?? '[]');

      for (const c of cats) catMap.set(c.name, (catMap.get(c.name) ?? 0) + c.total);
      for (const p of pms)  {
        const existing = pmMap.get(p.name);
        pmMap.set(p.name, { type: p.type, total: (existing?.total ?? 0) + p.total });
      }
    }

    // ── Live expenses (open weeks only) ───────────────────────────────────────
    const dateFilter = (col: string) => {
      const parts: string[] = [];
      if (start) parts.push(`${col} >= '${start}'`);
      if (end)   parts.push(`${col} <= '${end}'`);
      return parts.length ? 'AND ' + parts.join(' AND ') : '';
    };

    const liveIncomeRows = await db.execute(
      `SELECT amount, date FROM income WHERE 1=1 ${dateFilter('date')}`
    );

    // Build closed week date ranges [friday, thursday] so we can exclude
    // income rows that belong to a closed week (income is never deleted on rollup)
    const closedRanges = Array.from(closedWeekStarts).map((ws) => ({
      start: ws,
      end:   thursdayOf(ws),
    }));

    let liveIncome = 0;
    for (const row of liveIncomeRows.rows) {
      const date = row.date as string;
      const inClosed = closedRanges.some((r) => date >= r.start && date <= r.end);
      if (!inClosed) liveIncome += Number(row.amount);
    }

    const liveCatRows = await db.execute(
      `SELECT c.name, c.is_transfer, COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       WHERE 1=1 ${dateFilter('e.date')}
       GROUP BY c.id, c.name, c.is_transfer
       ORDER BY total DESC`
    );

    let liveExpenses = 0;
    let liveCC       = 0;

    for (const row of liveCatRows.rows) {
      const amt = Number(row.total);
      if (Number(row.is_transfer) === 1) {
        liveCC += amt;
      } else {
        liveExpenses += amt;
        catMap.set(row.name as string, (catMap.get(row.name as string) ?? 0) + amt);
      }
    }

    const livePmRows = await db.execute(
      `SELECT pm.name, pm.type, COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       JOIN payment_methods pm ON pm.id = e.payment_method_id
       JOIN categories c ON c.id = e.category_id
       WHERE c.is_transfer = 0 ${dateFilter('e.date')}
       GROUP BY pm.id, pm.name, pm.type
       ORDER BY total DESC`
    );

    for (const row of livePmRows.rows) {
      const name = row.name as string;
      const existing = pmMap.get(name);
      pmMap.set(name, { type: row.type as string, total: (existing?.total ?? 0) + Number(row.total) });
    }

    // ── Combine ───────────────────────────────────────────────────────────────
    const income         = closedIncome   + liveIncome;
    const total_expenses = closedExpenses + liveExpenses;
    const cc_payments    = closedCC       + liveCC;

    const result: AnalysisResult = {
      income,
      total_expenses,
      cc_payments,
      net_savings: income - total_expenses - cc_payments,
      by_category: Array.from(catMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
      by_payment_method: Array.from(pmMap.entries())
        .map(([name, { type, total }]) => ({ name, type, total }))
        .sort((a, b) => b.total - a.total),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}

function thursdayOf(friday: string): string {
  const d = new Date(friday + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}
