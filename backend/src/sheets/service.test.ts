import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../test/db.js';
import { schema, DbClient } from '../db/client.js';
import { WeeklySheetService, SheetsEnv } from './service.js';

function toPem(bytes: Uint8Array, label: string): string {
  const b64 = Buffer.from(bytes).toString('base64');
  const wrapped = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
}

interface FetchCall {
  url: string;
  init?: RequestInit;
  body?: unknown;
}

function recordingFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): { fetcher: (input: string | URL | Request, init?: RequestInit) => Promise<Response>; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let body: unknown;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, init, body });
    return handler(url, init);
  };
  return { fetcher, calls };
}

const WEEK_MONDAY = Date.UTC(2026, 7, 10);

function eqAction(action: string) {
  return eq(schema.auditLogs.action, action);
}

describe('WeeklySheetService', () => {
  let db: DbClient;
  let privatePem: string;

  beforeEach(async () => {
    db = createTestDb();
    const keyPair = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as { privateKey: CryptoKey; publicKey: CryptoKey };
    privatePem = toPem(
      new Uint8Array((await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)) as ArrayBuffer),
      'PRIVATE KEY',
    );

    await db.insert(schema.bookingPolicies).values({
      id: 'pol-1',
      name: 'Default policy',
      bookingHorizonDays: 7,
      minBookingDurationMinutes: 30,
      maxBookingDurationMinutes: 120,
      bookingIntervalMinutes: 30,
      active: true,
    });
    await db.insert(schema.systemSettings).values({
      id: 'ss-1',
      bookingReleaseDay: 1,
      bookingReleaseTime: '09:00',
      defaultPolicyId: 'pol-1',
    });
    await db.insert(schema.rooms).values({
      id: 'room-main',
      name: 'Main Room',
      number: 1,
      createdAt: 1,
      active: true,
      policyId: 'pol-1',
    });
    await db.insert(schema.operatingSchedules).values({
      id: 'os-mon-0900',
      policyId: 'pol-1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      enabled: true,
    });
    await db.insert(schema.profiles).values({
      id: 'profile-choir',
      name: 'University Choir',
      color: '#4F46E5',
      createdAt: 1,
    });
    await db.insert(schema.users).values({
      id: 'user-1',
      username: 'manager',
      email: 'manager@test.local',
      name: 'Manager',
      passwordHash: 'x',
      role: 'ADMIN',
      createdAt: 1,
      updatedAt: 1,
    });
    await db.insert(schema.bookings).values({
      id: 'b1',
      roomId: 'room-main',
      profileId: 'profile-choir',
      userId: 'user-1',
      startTime: Date.UTC(2026, 7, 10, 9, 0),
      endTime: Date.UTC(2026, 7, 10, 10, 0),
      status: 'APPROVED',
      createdAt: 1,
    });
  });

  const countBookings = async () => (await db.select().from(schema.bookings)).length;

  function envWithCreds(): SheetsEnv {
    return {
      GOOGLE_SERVICE_ACCOUNT: JSON.stringify({
        client_email: 'sheets@rejoy.example.iam.gserviceaccount.com',
        private_key: privatePem,
        token_uri: 'https://oauth2.googleapis.com/token',
      }),
    };
  }

  function configureSpreadsheet(prefix = 'Test Venue') {
    return db
      .update(schema.systemSettings)
      .set({ sheetsSpreadsheetId: 'SPREADSHEET-123', sheetsSheetName: prefix });
  }

  it('writes the weekly grid and records SHEETS_JOB_OK', async () => {
    await configureSpreadsheet();
    const { fetcher, calls } = recordingFetch(async (url, init) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'tok-123' }), { status: 200 });
      }
      return new Response(JSON.stringify({ updatedCells: 1 }), { status: 200 });
    });

    const service = new WeeklySheetService(db, envWithCreds(), fetcher);
    const before = await countBookings();
    const result = await service.run(WEEK_MONDAY);

    expect(result.status).toBe('ok');
    expect(result.tabName).toBe('Test Venue - Week of 2026-08-10');
    expect(result.rows).toBe(7);
    expect(result.bookings).toBe(1);
    expect(calls).toHaveLength(2);

    // The grid cell for Main Room - Monday @ 09:00 carries the band name.
    const update = calls[1].body as { values?: string[][] };
    const grid = update.values!;
    expect(grid[0]).toEqual(['Room / Day', '09:00']);
    expect(grid.find((row) => row[0] === 'Main Room - Monday')?.[1]).toBe('University Choir');

    const audits = await db.select().from(schema.auditLogs).where(eqAction('SHEETS_JOB_OK'));
    expect(audits).toHaveLength(1);
    expect(audits[0].targetType).toBe('WEEKLY_SHEET');
    expect(audits[0].targetId).toBe('Test Venue - Week of 2026-08-10');

    // Bookings are never modified by the job.
    expect(await countBookings()).toBe(before);
  });

  it('skips when no spreadsheet is configured and never calls Google', async () => {
    const { fetcher, calls } = recordingFetch(async () => new Response('unexpected', { status: 500 }));
    const service = new WeeklySheetService(db, envWithCreds(), fetcher);

    const result = await service.run(WEEK_MONDAY);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('spreadsheet not configured');
    expect(calls).toHaveLength(0);
    const audits = await db.select().from(schema.auditLogs).where(eqAction('SHEETS_JOB_SKIPPED'));
    expect(audits).toHaveLength(1);
  });

  it('skips when service account credentials are missing', async () => {
    await configureSpreadsheet();
    const { fetcher, calls } = recordingFetch(async () => new Response('unexpected', { status: 500 }));
    const service = new WeeklySheetService(db, {}, fetcher);

    const result = await service.run(WEEK_MONDAY);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('GOOGLE_SERVICE_ACCOUNT not configured');
    expect(calls).toHaveLength(0);
  });

  it('reports failure, records SHEETS_JOB_FAILED, and never throws', async () => {
    await configureSpreadsheet();
    const { fetcher } = recordingFetch(async () => new Response('forbidden', { status: 403 }));
    const service = new WeeklySheetService(db, envWithCreds(), fetcher);

    const before = await countBookings();
    const result = await service.run(WEEK_MONDAY);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Google token exchange failed');
    expect(await countBookings()).toBe(before);

    const audits = await db.select().from(schema.auditLogs).where(eqAction('SHEETS_JOB_FAILED'));
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata).toContain('failed');
  });

  it('uses the deterministic tab name when no prefix is configured', async () => {
    await configureSpreadsheet('');
    const { fetcher } = recordingFetch(async (url) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const service = new WeeklySheetService(db, envWithCreds(), fetcher);
    const result = await service.run(WEEK_MONDAY);
    expect(result.tabName).toBe('Week of 2026-08-10');
  });
});
