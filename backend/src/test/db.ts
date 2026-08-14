import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as schema from '../db/schema.js';
import { DbClient } from '../db/client.js';

export function createTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const here = dirname(fileURLToPath(import.meta.url));
  const migration = readFileSync(resolve(here, '../../drizzle/0000_large_harpoon.sql'), 'utf8');
  sqlite.exec(migration);
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
