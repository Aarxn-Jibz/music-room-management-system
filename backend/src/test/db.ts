import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as schema from '../db/schema.js';
import { DbClient } from '../db/client.js';

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export function createTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  for (const migration of migrations) {
    sqlite.exec(readFileSync(resolve(MIGRATIONS_DIR, migration), 'utf8'));
  }
  const db = drizzle(sqlite, { schema }) as unknown as DbClient;
  (db as unknown as Record<string, unknown>).batch = async (queries: { run: () => Promise<unknown> }[]) => {
    const results: unknown[] = [];
    for (const query of queries) {
      results.push(await query.run());
    }
    return results;
  };
  return db;
}
