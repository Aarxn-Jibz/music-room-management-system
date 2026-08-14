/**
 * Local dev harness for the weekly Google Sheets export.
 *
 * Reads the local D1 database (used by `wrangler dev`) read-only, builds the
 * weekly grid and prints it — no network, no credentials required.
 *
 *   npm run sheets:dry-run                 # current week
 *   npm run sheets:dry-run -- 2026-08-16   # a specific Sunday / date
 *
 * Optional `--real` performs the full export against Google Sheets using the
 * spreadsheet configured in system settings and GOOGLE_SERVICE_ACCOUNT:
 *
 *   GOOGLE_SERVICE_ACCOUNT='{...}' npm run sheets:dry-run -- --real
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema.js';
import type { DbClient } from '../src/db/client.js';
import { WeeklySheetService } from '../src/sheets/service.js';
import { weekMondayUtc } from '../src/sheets/time.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function findLocalD1Sqlite(): string {
  const dir = resolve(ROOT, '.wrangler/state/v3/d1');
  if (!existsSync(dir)) throw new Error(`Local D1 state not found at ${dir}. Run 'npm run db:migrate' / start 'wrangler dev' first.`);
  const files: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = resolve(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.sqlite')) files.push(p);
    }
  };
  walk(dir);
  if (files.length === 0) throw new Error(`No D1 sqlite file found under ${dir}`);
  return files[0];
}

function printGrid(result: { tabName: string; header: string[]; rows: string[][] }) {
  const widths = result.header.map((_, col) =>
    Math.max(...result.rows.map((row) => row[col]?.length ?? 0), result.header[col].length),
  );
  const line = (cells: string[]) =>
    cells.map((cell, i) => (cell ?? '').padEnd(widths[i])).join(' | ');

  console.log(`\nTab: ${result.tabName}`);
  console.log(line(result.header));
  console.log('-'.repeat(line(result.header).length));
  for (const row of result.rows) console.log(line(row));
  const bookingCells = result.rows.reduce(
    (sum, row) => sum + row.slice(1).filter((cell) => cell !== '').length,
    0,
  );
  console.log(`\n${result.rows.length} rows, ${bookingCells} booking cell(s) filled.\n`);
}

const args = process.argv.slice(2);
const real = args.includes('--real');
const dateArg = args.find((a) => a !== '--real');
const nowMs = dateArg ? new Date(dateArg).getTime() : Date.now();

if (Number.isNaN(nowMs)) {
  console.error(`Invalid date argument: ${dateArg}`);
  process.exit(1);
}

const sqliteFile = findLocalD1Sqlite();
console.log(`Reading local D1: ${sqliteFile}`);

const sqlite = new Database(sqliteFile, { readonly: true });
const db = drizzle(sqlite, { schema }) as unknown as DbClient;

const service = new WeeklySheetService(db, process.env as Record<string, string | undefined>);

if (real) {
  const result = await service.run(nowMs);
  console.log('Real run result:', JSON.stringify(result, null, 2));
} else {
  const monday = weekMondayUtc(nowMs);
  const grid = await service.preview(nowMs);
  console.log(`Week Monday: ${new Date(monday).toISOString().slice(0, 10)}`);
  printGrid(grid);
}

sqlite.close();
