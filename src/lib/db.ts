import { createClient, type Client } from '@libsql/client';

let _client: Client | null = null;
let _schemaReady = false;

export function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('TURSO_DATABASE_URL is not set');

    _client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return _client;
}

/**
 * Returns a ready-to-use client with the schema guaranteed to exist.
 * Schema creation is only run once per process lifetime.
 */
export async function getDb(): Promise<Client> {
  const client = getClient();
  if (!_schemaReady) {
    await initSchema(client);
    _schemaReady = true;
  }
  return client;
}

async function initSchema(client: Client): Promise<void> {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      is_transfer INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS payment_methods (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE,
      type TEXT    NOT NULL CHECK(type IN ('credit', 'debit'))
    )`,
    `CREATE TABLE IF NOT EXISTS income (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL    NOT NULL CHECK(amount > 0),
      date        TEXT    NOT NULL,
      week_number INTEGER NOT NULL,
      year        INTEGER NOT NULL,
      notes       TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      amount                  REAL    NOT NULL CHECK(amount > 0),
      category_id             INTEGER NOT NULL REFERENCES categories(id),
      payment_method_id       INTEGER          REFERENCES payment_methods(id),
      date                    TEXT    NOT NULL,
      week_number             INTEGER NOT NULL,
      year                    INTEGER NOT NULL,
      notes                   TEXT
    )`,
    // CC Payment is a transfer — the real expense was already counted when the card was charged
    `UPDATE categories SET is_transfer = 1 WHERE name = 'CC Payment'`,
    `CREATE INDEX IF NOT EXISTS idx_income_week   ON income(year, week_number)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_week ON expenses(year, week_number)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_cat  ON expenses(category_id)`,
    `CREATE TABLE IF NOT EXISTS week_summaries (
      week_start               TEXT PRIMARY KEY,
      income                   REAL NOT NULL DEFAULT 0,
      total_expenses           REAL NOT NULL DEFAULT 0,
      cc_payments              REAL NOT NULL DEFAULT 0,
      net_savings              REAL NOT NULL DEFAULT 0,
      category_breakdown       TEXT NOT NULL DEFAULT '[]',
      payment_method_breakdown TEXT NOT NULL DEFAULT '[]'
    )`,
    // Tracks running balance per credit card
    `CREATE TABLE IF NOT EXISTS cc_balances (
      payment_method_id INTEGER PRIMARY KEY REFERENCES payment_methods(id),
      balance           REAL NOT NULL DEFAULT 0
    )`,
  ], 'write');

  // Migration: add cc_payment_target_id column to expenses (idempotent)
  try {
    await client.execute(
      'ALTER TABLE expenses ADD COLUMN cc_payment_target_id INTEGER REFERENCES payment_methods(id)'
    );
  } catch {
    // Column already exists — ignore
  }

  // Seed cc_balances for credit cards that don't have a row yet,
  // computing the real balance from existing open expenses.
  const creditCards = await client.execute(
    `SELECT id FROM payment_methods WHERE type = 'credit'`
  );

  // If there is only one credit card, all legacy CC Payment expenses
  // (those without cc_payment_target_id) must be for that card.
  const singleCard = creditCards.rows.length === 1
    ? (creditCards.rows[0].id as number)
    : null;

  // ── Migrate legacy CC Payment expenses ──────────────────────────────────
  // For each unattributed CC Payment, backfill cc_payment_target_id and
  // subtract the amount from cc_balances. This runs only for rows that still
  // have cc_payment_target_id = NULL, so it is idempotent.
  if (singleCard !== null) {
    const legacy = await client.execute({
      sql: `SELECT e.id, e.amount
            FROM expenses e
            JOIN categories c ON c.id = e.category_id
            WHERE c.name = 'CC Payment' AND e.cc_payment_target_id IS NULL`,
    });

    if (legacy.rows.length > 0) {
      const legacyTotal = legacy.rows.reduce((s, r) => s + Number(r.amount), 0);

      // Stamp the target on each legacy row so this won't run again next restart
      for (const r of legacy.rows) {
        await client.execute({
          sql: `UPDATE expenses SET cc_payment_target_id = ? WHERE id = ?`,
          args: [singleCard, r.id as number],
        });
      }

      // Ensure a cc_balances row exists for this card first, then subtract
      await client.execute({
        sql: `INSERT OR IGNORE INTO cc_balances (payment_method_id, balance) VALUES (?, 0)`,
        args: [singleCard],
      });
      await client.execute({
        sql: `UPDATE cc_balances SET balance = balance - ? WHERE payment_method_id = ?`,
        args: [legacyTotal, singleCard],
      });
    }
  }

  // ── Seed any credit cards that still have no cc_balances row ────────────
  for (const row of creditCards.rows) {
    const cardId = row.id as number;

    const chargesRes = await client.execute({
      sql: `SELECT COALESCE(SUM(e.amount), 0) AS total
            FROM expenses e
            JOIN categories c ON c.id = e.category_id
            WHERE e.payment_method_id = ? AND c.name != 'CC Payment'`,
      args: [cardId],
    });
    const charges = Number(chargesRes.rows[0]?.total ?? 0);

    const paymentsRes = await client.execute({
      sql: `SELECT COALESCE(SUM(amount), 0) AS total
            FROM expenses WHERE cc_payment_target_id = ?`,
      args: [cardId],
    });
    const payments = Number(paymentsRes.rows[0]?.total ?? 0);

    // Only insert if no row exists yet; existing tracked balances are left untouched.
    await client.execute({
      sql: `INSERT OR IGNORE INTO cc_balances (payment_method_id, balance) VALUES (?, ?)`,
      args: [cardId, charges - payments],
    });
  }
}
