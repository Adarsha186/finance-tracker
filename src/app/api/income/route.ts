import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { weekFromDateStr, fridayOf } from '@/utils/week';
import type { Income } from '@/types';

export const runtime = 'nodejs';

// GET /api/income?week=11&year=2026
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const week = searchParams.get('week');
    const year = searchParams.get('year');

    const result = week && year
      ? await db.execute({
          sql:  'SELECT * FROM income WHERE week_number = ? AND year = ? ORDER BY date',
          args: [Number(week), Number(year)],
        })
      : await db.execute('SELECT * FROM income ORDER BY date DESC');

    return NextResponse.json(result.rows as unknown as Income[]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch income' }, { status: 500 });
  }
}

// POST /api/income  body: { amount, date, notes? }
// Upserts: if an income entry already exists for that week, updates it instead of inserting a duplicate.
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const { amount, date, notes } = await req.json();

    if (!amount || !date) {
      return NextResponse.json({ error: 'amount and date are required' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const { week_number, year } = weekFromDateStr(date);

    // Find the Friday that starts this pay week, then look for any income
    // entry whose date falls within that Friday→Thursday window.
    const friday  = fridayOf(date);
    const thursday = (() => {
      const d = new Date(friday + 'T12:00:00');
      d.setDate(d.getDate() + 6);
      return d.toISOString().split('T')[0];
    })();

    const existing = await db.execute({
      sql:  'SELECT id FROM income WHERE date >= ? AND date <= ? LIMIT 1',
      args: [friday, thursday],
    });

    let row: Income;

    if (existing.rows.length > 0) {
      // Update the existing record
      const id = existing.rows[0].id;
      await db.execute({
        sql:  'UPDATE income SET amount = ?, date = ?, notes = ? WHERE id = ?',
        args: [amount, date, notes ?? null, id],
      });
      const updated = await db.execute({ sql: 'SELECT * FROM income WHERE id = ?', args: [id] });
      row = updated.rows[0] as unknown as Income;
    } else {
      // Insert new record
      const result = await db.execute({
        sql:  'INSERT INTO income (amount, date, week_number, year, notes) VALUES (?, ?, ?, ?, ?)',
        args: [amount, date, week_number, year, notes ?? null],
      });
      const inserted = await db.execute({
        sql:  'SELECT * FROM income WHERE id = ?',
        args: [result.lastInsertRowid!],
      });
      row = inserted.rows[0] as unknown as Income;
    }

    return NextResponse.json(row, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save income entry' }, { status: 500 });
  }
}
