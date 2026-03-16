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
    e.date,
    e.week_number,
    e.year,
    e.notes
  FROM expenses e
  JOIN categories c ON c.id = e.category_id
  LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
`;

// GET /api/expenses?week=11&year=2026&category_id=3
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const week        = searchParams.get('week');
    const year        = searchParams.get('year');
    const category_id = searchParams.get('category_id');

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

// POST /api/expenses  body: { amount, category_id, payment_method_id?, date, notes? }
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const { amount, category_id, payment_method_id, date, notes } = await req.json();

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
      sql: `INSERT INTO expenses (amount, category_id, payment_method_id, date, week_number, year, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [amount, category_id, payment_method_id ?? null, date, week_number, year, notes ?? null],
    });

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
