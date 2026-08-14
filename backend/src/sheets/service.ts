import { schema } from '../db/client.js';
import type { DbClient } from '../db/client.js';
import { writeAuditLog } from '../audit/index.js';
import { buildWeeklyGrid, WeeklyGrid } from './grid.js';
import { describeUtcInstant, formatTabName, weekMondayUtc } from './time.js';
import { buildServiceAccountAssertion, GOOGLE_SHEETS_SCOPE, ServiceAccountCredentials } from './jwt.js';
import {
  addSheet,
  batchClear,
  exchangeToken,
  Fetcher,
  listSheetTitles,
  staleClearRanges,
  updateSpreadsheet,
} from './google.js';

export type SheetJobStatus = 'ok' | 'skipped' | 'failed';

export interface SheetJobResult {
  status: SheetJobStatus;
  weekMonday: number;
  tabName: string | null;
  rows?: number;
  cols?: number;
  bookings?: number;
  reason?: string;
  error?: string;
}

export interface SheetsEnv {
  GOOGLE_SERVICE_ACCOUNT?: string;
}

/**
 * Weekly Google Sheets export of APPROVED bookings.
 * - Reads only (never creates/modifies/deletes bookings).
 * - Never throws: every path returns a result and is audit-logged.
 * - Idempotent: the same week always writes to the same tab via full-range
 *   overwrite. The tab is auto-created when missing, and cells left over from
 *   larger grids are cleared after the write.
 * - The cron fires Sunday 15:30 UTC (21:00 IST); the exported week is the one
 *   containing the run, i.e. the current/about-to-end week (product intent).
 */
export class WeeklySheetService {
  constructor(
    private db: DbClient,
    private env: SheetsEnv,
    private fetchImpl: Fetcher = globalThis.fetch,
  ) {}

  preview(nowMs: number = Date.now()): Promise<WeeklyGrid> {
    return buildWeeklyGrid(this.db, weekMondayUtc(nowMs));
  }

  private credentials(): { credentials: ServiceAccountCredentials | null; reason: string } {
    const raw = this.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw) {
      return { credentials: null, reason: 'GOOGLE_SERVICE_ACCOUNT not configured' };
    }
    try {
      const parsed = JSON.parse(raw) as {
        client_email?: string;
        private_key?: string;
        token_uri?: string;
      };
      if (!parsed.client_email || !parsed.private_key || !parsed.token_uri) {
        return {
          credentials: null,
          reason: 'GOOGLE_SERVICE_ACCOUNT invalid: missing client_email, private_key, or token_uri',
        };
      }
      return {
        credentials: {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
          tokenUri: parsed.token_uri,
          scope: GOOGLE_SHEETS_SCOPE,
        },
        reason: '',
      };
    } catch {
      return { credentials: null, reason: 'GOOGLE_SERVICE_ACCOUNT invalid: not valid JSON' };
    }
  }

  private async settingsRow() {
    const rows = await this.db.select().from(schema.systemSettings).limit(1);
    return rows[0] ?? null;
  }

  async run(nowMs: number = Date.now()): Promise<SheetJobResult> {
    const weekMonday = weekMondayUtc(nowMs);
    const labels = describeUtcInstant(nowMs);
    let tabName: string | null = null;

    try {
      const settings = await this.settingsRow();
      const spreadsheetId = settings?.sheetsSpreadsheetId?.trim() || null;
      if (!spreadsheetId) {
        return this.skip(weekMonday, 'spreadsheet not configured', labels.utc);
      }

      const { credentials, reason } = this.credentials();
      if (!credentials) {
        return this.skip(weekMonday, reason, labels.utc);
      }

      const grid = await buildWeeklyGrid(this.db, weekMonday);
      tabName = formatTabName(settings?.sheetsSheetName, weekMonday);

      const assertion = await buildServiceAccountAssertion(credentials, nowMs);
      const accessToken = await exchangeToken(this.fetchImpl, credentials.tokenUri, assertion);

      const titles = await listSheetTitles(this.fetchImpl, spreadsheetId, accessToken);
      if (!titles.includes(tabName)) {
        await addSheet(this.fetchImpl, spreadsheetId, accessToken, tabName);
      }

      await updateSpreadsheet(this.fetchImpl, accessToken, {
        spreadsheetId,
        tabName,
        values: [grid.header, ...grid.rows],
      });
      await batchClear(
        this.fetchImpl,
        spreadsheetId,
        accessToken,
        staleClearRanges(tabName, grid.rows.length, grid.header.length),
      );

      const bookings = grid.rows.reduce(
        (sum, row) => sum + row.slice(1).filter((cell) => cell !== '').length,
        0,
      );
      const result: SheetJobResult = {
        status: 'ok',
        weekMonday,
        tabName,
        rows: grid.rows.length,
        cols: grid.header.length,
        bookings,
      };
      await this.safeAudit(
        'SHEETS_JOB_OK',
        result,
        { utc: labels.utc, ist: labels.ist, spreadsheetId },
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: SheetJobResult = {
        status: 'failed',
        weekMonday,
        tabName,
        error: message,
      };
      await this.safeAudit('SHEETS_JOB_FAILED', result, { utc: labels.utc, ist: labels.ist });
      console.error('[weekly-sheet] job failed:', message);
      return result;
    }
  }

  private async skip(weekMonday: number, reason: string, utc: string): Promise<SheetJobResult> {
    const result: SheetJobResult = {
      status: 'skipped',
      weekMonday,
      tabName: null,
      reason,
    };
    await this.safeAudit('SHEETS_JOB_SKIPPED', result, { utc });
    return result;
  }

  private async audit(
    action: string,
    result: SheetJobResult,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await writeAuditLog(this.db, null, action, 'WEEKLY_SHEET', result.tabName, {
      ...metadata,
      weekMonday: result.weekMonday,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
  }

  // Audit logging is best-effort: a DB failure while the job is running must
  // not turn a non-throwing run into a thrown one.
  private async safeAudit(
    action: string,
    result: SheetJobResult,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit(action, result, metadata);
    } catch (err) {
      console.error(`[weekly-sheet] audit ${action} failed:`, err);
    }
  }
}
