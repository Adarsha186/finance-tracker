import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Category } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM categories ORDER BY name');
    return NextResponse.json(result.rows as unknown as Category[]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
