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
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      amount            REAL    NOT NULL CHECK(amount > 0),
      category_id       INTEGER NOT NULL REFERENCES categories(id),
      payment_method_id INTEGER          REFERENCES payment_methods(id),
      date              TEXT    NOT NULL,
      week_number       INTEGER NOT NULL,
      year              INTEGER NOT NULL,
      notes             TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_income_week   ON income(year, week_number)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_week ON expenses(year, week_number)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_cat  ON expenses(category_id)`,
  ], 'write');
}
