import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { CreditCardBalance } from '@/types';

export const runtime = 'nodejs';

// GET /api/cc-balances — returns balance + open-week activity for every credit card
export async function GET() {
  try {
    const db = await getDb();
    const result = await db.execute(`
      SELECT
        pm.id   AS payment_method_id,
        pm.name,
        cb.balance,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          JOIN categories c ON c.id = e.category_id
          WHERE e.payment_method_id = pm.id
            AND c.name != 'CC Payment'
        ), 0) AS open_charges,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.cc_payment_target_id = pm.id
        ), 0) AS open_payments
      FROM payment_methods pm
      JOIN cc_balances cb ON cb.payment_method_id = pm.id
      WHERE pm.type = 'credit'
      ORDER BY pm.name
    `);
    return NextResponse.json(result.rows as unknown as CreditCardBalance[]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch CC balances' }, { status: 500 });
  }
}

// PATCH /api/cc-balances — manually set a card's balance
// body: { payment_method_id: number, balance: number }
export async function PATCH(req: NextRequest) {
  try {
    const { payment_method_id, balance } = await req.json();
    if (!payment_method_id || typeof balance !== 'number') {
      return NextResponse.json(
        { error: 'payment_method_id and balance are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO cc_balances (payment_method_id, balance) VALUES (?, ?)
            ON CONFLICT(payment_method_id) DO UPDATE SET balance = excluded.balance`,
      args: [payment_method_id, balance],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update CC balance' }, { status: 500 });
  }
}
