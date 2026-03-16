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
