/**
 * Seed script — run once to populate the database with sample data.
 * Usage: npx tsx src/lib/seed.ts
 *
 * Safe to re-run: clears existing data before inserting.
 */

import { getDb } from './db';
import { weekFromDateStr } from '../utils/week';

async function main() {
  const db = await getDb();

  // ─── Wipe existing data ────────────────────────────────────────────────────
  await db.batch([
    'DELETE FROM expenses',
    'DELETE FROM income',
    'DELETE FROM payment_methods',
    'DELETE FROM categories',
  ], 'write');

  // ─── Categories ───────────────────────────────────────────────────────────
  const categories = [
    { name: 'Rent',          is_transfer: 0 },
    { name: 'Home',          is_transfer: 0 },
    { name: 'Groceries',     is_transfer: 0 },
    { name: 'Gas',           is_transfer: 0 },
    { name: 'Dining',        is_transfer: 0 },
    { name: 'Entertainment', is_transfer: 0 },
    { name: 'Subscriptions', is_transfer: 0 },
    { name: 'Medical',       is_transfer: 0 },
    { name: 'Misc',          is_transfer: 0 },
    { name: 'CC Payment',    is_transfer: 1 },
  ];

  await db.batch(
    categories.map((c) => ({
      sql:  'INSERT INTO categories (name, is_transfer) VALUES (?, ?)',
      args: [c.name, c.is_transfer],
    })),
    'write'
  );

  const catResult = await db.execute('SELECT id, name FROM categories');
  const categoryIds: Record<string, number> = {};
  for (const row of catResult.rows) {
    categoryIds[row.name as string] = Number(row.id);
  }

  // ─── Payment Methods ──────────────────────────────────────────────────────
  await db.batch(
    [
      { sql: 'INSERT INTO payment_methods (name, type) VALUES (?, ?)', args: ['Amex',  'credit'] },
      { sql: 'INSERT INTO payment_methods (name, type) VALUES (?, ?)', args: ['Chase', 'debit']  },
    ],
    'write'
  );

  const pmResult = await db.execute('SELECT id, name FROM payment_methods');
  const pmIds: Record<string, number> = {};
  for (const row of pmResult.rows) {
    pmIds[row.name as string] = Number(row.id);
  }

  // ─── Income (4 weeks, Monday pay dates) ───────────────────────────────────
  const incomeEntries = [
    { amount: 800, date: '2026-02-16', notes: 'Weekly pay' },
    { amount: 800, date: '2026-02-23', notes: 'Weekly pay' },
    { amount: 800, date: '2026-03-02', notes: 'Weekly pay' },
    { amount: 800, date: '2026-03-09', notes: 'Weekly pay' },
  ];

  await db.batch(
    incomeEntries.map((e) => {
      const { week_number, year } = weekFromDateStr(e.date);
      return {
        sql:  'INSERT INTO income (amount, date, week_number, year, notes) VALUES (?, ?, ?, ?, ?)',
        args: [e.amount, e.date, week_number, year, e.notes],
      };
    }),
    'write'
  );

  // ─── Expenses ─────────────────────────────────────────────────────────────
  type ExpenseSeed = {
    amount: number;
    category: string;
    payment_method: string | null;
    date: string;
    notes?: string;
  };

  const expenseEntries: ExpenseSeed[] = [
    // Week 8: Feb 16–22
    { amount: 600,   category: 'Rent',          payment_method: 'Chase', date: '2026-02-16', notes: 'Monthly rent' },
    { amount: 82,    category: 'Groceries',     payment_method: 'Chase', date: '2026-02-17' },
    { amount: 44,    category: 'Gas',           payment_method: 'Chase', date: '2026-02-18' },
    { amount: 31,    category: 'Dining',        payment_method: 'Amex',  date: '2026-02-19', notes: 'Lunch with coworkers' },
    { amount: 15.99, category: 'Subscriptions', payment_method: 'Amex',  date: '2026-02-16', notes: 'Netflix' },
    { amount: 200,   category: 'CC Payment',    payment_method: 'Chase', date: '2026-02-20', notes: 'Amex bill payment' },
    // Week 9: Feb 23 – Mar 1
    { amount: 71,    category: 'Groceries',     payment_method: 'Chase', date: '2026-02-24' },
    { amount: 40,    category: 'Gas',           payment_method: 'Chase', date: '2026-02-25' },
    { amount: 27,    category: 'Dining',        payment_method: 'Amex',  date: '2026-02-26', notes: 'Pizza night' },
    { amount: 24,    category: 'Entertainment', payment_method: 'Amex',  date: '2026-02-27', notes: 'Movie tickets' },
    { amount: 9.99,  category: 'Subscriptions', payment_method: 'Amex',  date: '2026-02-23', notes: 'Spotify' },
    { amount: 150,   category: 'CC Payment',    payment_method: 'Chase', date: '2026-02-28', notes: 'Amex bill payment' },
    // Week 10: Mar 2–8
    { amount: 89,    category: 'Groceries',     payment_method: 'Chase', date: '2026-03-03' },
    { amount: 50,    category: 'Gas',           payment_method: 'Chase', date: '2026-03-04' },
    { amount: 45,    category: 'Dining',        payment_method: 'Amex',  date: '2026-03-05', notes: 'Date night' },
    { amount: 34,    category: 'Home',          payment_method: 'Chase', date: '2026-03-06', notes: 'Cleaning supplies' },
    { amount: 9.99,  category: 'Subscriptions', payment_method: 'Amex',  date: '2026-03-02', notes: 'Spotify' },
    { amount: 18,    category: 'Misc',          payment_method: 'Amex',  date: '2026-03-07', notes: 'Birthday gift bag' },
    { amount: 180,   category: 'CC Payment',    payment_method: 'Chase', date: '2026-03-07', notes: 'Amex bill payment' },
    // Week 11: Mar 9–15 (current)
    { amount: 77,    category: 'Groceries',     payment_method: 'Chase', date: '2026-03-10' },
    { amount: 42,    category: 'Gas',           payment_method: 'Chase', date: '2026-03-11' },
    { amount: 54,    category: 'Dining',        payment_method: 'Amex',  date: '2026-03-12', notes: 'Dinner out' },
    { amount: 29,    category: 'Entertainment', payment_method: 'Amex',  date: '2026-03-13', notes: 'Concert ticket' },
    { amount: 25,    category: 'Medical',       payment_method: 'Chase', date: '2026-03-14', notes: 'Copay' },
    { amount: 9.99,  category: 'Subscriptions', payment_method: 'Amex',  date: '2026-03-09', notes: 'Spotify' },
    { amount: 160,   category: 'CC Payment',    payment_method: 'Chase', date: '2026-03-14', notes: 'Amex bill payment' },
  ];

  await db.batch(
    expenseEntries.map((e) => {
      const { week_number, year } = weekFromDateStr(e.date);
      return {
        sql: `INSERT INTO expenses (amount, category_id, payment_method_id, date, week_number, year, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          e.amount,
          categoryIds[e.category],
          e.payment_method ? pmIds[e.payment_method] : null,
          e.date,
          week_number,
          year,
          e.notes ?? null,
        ],
      };
    }),
    'write'
  );

  const [{ rows: [{ n: incCount }] }, { rows: [{ n: expCount }] }] = await Promise.all([
    db.execute('SELECT COUNT(*) AS n FROM income'),
    db.execute('SELECT COUNT(*) AS n FROM expenses'),
  ]);

  console.log('✓ Seed complete');
  console.log(`  ${categories.length} categories, ${Object.keys(pmIds).length} payment methods`);
  console.log(`  ${incCount} income entries, ${expCount} expense entries`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
