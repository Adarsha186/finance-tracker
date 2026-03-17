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

export async function POST(request: Request) {
  try {
    const { name, is_transfer } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const db = await getDb();
    const result = await db.execute({
      sql: 'INSERT INTO categories (name, is_transfer) VALUES (?, ?) RETURNING *',
      args: [name.trim(), is_transfer ? 1 : 0],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const db = await getDb();

    // Check if any expenses use this category
    const used = await db.execute({ sql: 'SELECT COUNT(*) as count FROM expenses WHERE category_id = ?', args: [id] });
    if (Number(used.rows[0]?.count) > 0) {
      return NextResponse.json({ error: 'Cannot delete — category is used by existing expenses' }, { status: 409 });
    }

    await db.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
