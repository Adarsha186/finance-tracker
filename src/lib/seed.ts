/**
 * Production reset script — clears all data and sets up base categories + payment methods.
 * Usage: npx tsx src/lib/seed.ts
 */

import { getDb } from './db';

async function main() {
  const db = await getDb();

  // ─── Wipe all data ─────────────────────────────────────────────────────────
  await db.batch([
    'DELETE FROM expenses',
    'DELETE FROM income',
    'DELETE FROM week_summaries',
    'DELETE FROM cc_balances',
    'DELETE FROM payment_methods',
    'DELETE FROM categories',
  ], 'write');

  // ─── Categories ───────────────────────────────────────────────────────────
  const categories = [
    { name: 'Rent',          is_transfer: 0 },
    { name: 'Subscriptions', is_transfer: 0 },
    { name: 'Misc',          is_transfer: 0 },
    { name: 'CC Payment',    is_transfer: 0 },
  ];

  await db.batch(
    categories.map((c) => ({
      sql:  'INSERT INTO categories (name, is_transfer) VALUES (?, ?)',
      args: [c.name, c.is_transfer],
    })),
    'write'
  );

  // ─── Payment Methods ──────────────────────────────────────────────────────
  const pmResult = await db.batch([
    { sql: 'INSERT INTO payment_methods (name, type) VALUES (?, ?) RETURNING id', args: ['Amex',  'credit'] },
    { sql: 'INSERT INTO payment_methods (name, type) VALUES (?, ?)',              args: ['Chase', 'debit']  },
  ], 'write');

  // Seed cc_balances for Amex
  const amexId = pmResult[0].rows[0]?.id as number;
  if (amexId) {
    await db.execute({
      sql:  'INSERT OR IGNORE INTO cc_balances (payment_method_id, balance) VALUES (?, 0)',
      args: [amexId],
    });
  }

  console.log('✓ Reset complete — production ready');
  console.log(`  ${categories.length} categories: ${categories.map((c) => c.name).join(', ')}`);
  console.log('  2 payment methods: Amex (credit), Chase (debit)');
  console.log('  All expenses, income, and history cleared');
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
