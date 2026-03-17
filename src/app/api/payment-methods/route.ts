import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { PaymentMethod } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM payment_methods ORDER BY name');
    return NextResponse.json(result.rows as unknown as PaymentMethod[]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, type } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!['credit', 'debit'].includes(type)) return NextResponse.json({ error: 'Type must be credit or debit' }, { status: 400 });

    const db = await getDb();
    const result = await db.execute({
      sql: 'INSERT INTO payment_methods (name, type) VALUES (?, ?) RETURNING *',
      args: [name.trim(), type],
    });

    if (type === 'credit') {
      const newId = (result.rows[0] as unknown as { id: number }).id;
      await db.execute({
        sql: 'INSERT OR IGNORE INTO cc_balances (payment_method_id, balance) VALUES (?, 0)',
        args: [newId],
      });
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Payment method already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const db = await getDb();

    const used = await db.execute({ sql: 'SELECT COUNT(*) as count FROM expenses WHERE payment_method_id = ?', args: [id] });
    if (Number(used.rows[0]?.count) > 0) {
      return NextResponse.json({ error: 'Cannot delete — payment method is used by existing expenses' }, { status: 409 });
    }

    await db.execute({ sql: 'DELETE FROM payment_methods WHERE id = ?', args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 });
  }
}
