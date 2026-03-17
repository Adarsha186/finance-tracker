import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { weekFromDateStr } from '@/utils/week';
import type { ExpenseWithRefs } from '@/types';

export const runtime = 'nodejs';

const JOINED_SELECT = `
  SELECT
    e.id,
    e.amount,
    e.category_id,
    c.name              AS category_name,
    c.is_transfer,
    e.payment_method_id,
    pm.name             AS payment_method_name,
    pm.type             AS payment_method_type,
    e.cc_payment_target_id,
    tpm.name            AS cc_payment_target_name,
    e.date,
    e.week_number,
    e.year,
    e.notes
  FROM expenses e
  JOIN categories c ON c.id = e.category_id
  LEFT JOIN payment_methods pm  ON pm.id  = e.payment_method_id
  LEFT JOIN payment_methods tpm ON tpm.id = e.cc_payment_target_id
`;

// GET /api/expenses?week=11&year=2026&category_id=3&payment_method_id=1
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const week              = searchParams.get('week');
    const year              = searchParams.get('year');
    const category_id       = searchParams.get('category_id');
    const payment_method_id = searchParams.get('payment_method_id');

    const week_start = searchParams.get('week_start'); // YYYY-MM-DD of the Friday

    const conditions: string[] = [];
    const args: (number | string)[] = [];

    if (week_start) {
      // Friday to Thursday (6 days later)
      const end = new Date(week_start + 'T12:00:00');
      end.setDate(end.getDate() + 6);
      const week_end = end.toISOString().split('T')[0];
      conditions.push('e.date >= ?', 'e.date <= ?');
      args.push(week_start, week_end);
    } else if (week && year) {
      conditions.push('e.week_number = ?', 'e.year = ?');
      args.push(Number(week), Number(year));
    }
    if (category_id) {
      conditions.push('e.category_id = ?');
      args.push(Number(category_id));
    }
    if (payment_method_id) {
      // For a credit card: fetch charges on the card OR payments targeting the card
      conditions.push('(e.payment_method_id = ? OR e.cc_payment_target_id = ?)');
      args.push(Number(payment_method_id), Number(payment_method_id));
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await db.execute({
      sql:  `${JOINED_SELECT} ${where} ORDER BY e.date DESC, e.id DESC`,
      args,
    });

    return NextResponse.json(result.rows as unknown as ExpenseWithRefs[]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses  body: { amount, category_id, payment_method_id?, cc_payment_target_id?, date, notes? }
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const { amount, category_id, payment_method_id, cc_payment_target_id, date, notes } = await req.json();

    if (!amount || !category_id || !date) {
      return NextResponse.json(
        { error: 'amount, category_id, and date are required' },
        { status: 400 }
      );
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const cat = await db.execute({
      sql: 'SELECT id FROM categories WHERE id = ?', args: [category_id],
    });
    if (cat.rows.length === 0) {
      return NextResponse.json({ error: 'category_id not found' }, { status: 400 });
    }

    const { week_number, year } = weekFromDateStr(date);

    const result = await db.execute({
      sql: `INSERT INTO expenses (amount, category_id, payment_method_id, cc_payment_target_id, date, week_number, year, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        amount,
        category_id,
        payment_method_id ?? null,
        cc_payment_target_id ?? null,
        date,
        week_number,
        year,
        notes ?? null,
      ],
    });

    // ── Update CC balances ──────────────────────────────────────────────────
    const upsertBalance = `
      INSERT INTO cc_balances (payment_method_id, balance) VALUES (?, ?)
      ON CONFLICT(payment_method_id) DO UPDATE SET balance = balance + excluded.balance`;

    if (cc_payment_target_id) {
      // CC Payment: paying off a specific credit card — reduce its balance
      await db.execute({ sql: upsertBalance, args: [cc_payment_target_id, -amount] });
    } else if (payment_method_id) {
      // Charged to a credit card: increase its balance
      const pmRow = await db.execute({
        sql: 'SELECT type FROM payment_methods WHERE id = ?', args: [payment_method_id],
      });
      if ((pmRow.rows[0]?.type as string) === 'credit') {
        await db.execute({ sql: upsertBalance, args: [payment_method_id, amount] });
      }
    }

    const inserted = await db.execute({
      sql:  `${JOINED_SELECT} WHERE e.id = ?`,
      args: [result.lastInsertRowid!],
    });

    return NextResponse.json(inserted.rows[0] as unknown as ExpenseWithRefs, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
