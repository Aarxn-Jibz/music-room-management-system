import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test/db.js';
import { schema, DbClient } from '../db/client.js';
import { buildWeeklyGrid } from './grid.js';

const WEEK_MONDAY = Date.UTC(2026, 7, 10); // Monday 2026-08-10

async function seed(db: DbClient) {
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
  await db.insert(schema.rooms).values([
    { id: 'room-main', name: 'Main Room', number: 1, createdAt: 1, active: true, policyId: 'pol-1' },
    { id: 'room-acoustic', name: 'Acoustic Room', number: 2, createdAt: 2, active: true, policyId: 'pol-1' },
  ]);
  await db.insert(schema.operatingSchedules).values([
    { id: 'os-mon-0900', policyId: 'pol-1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', enabled: true },
    { id: 'os-mon-1000', policyId: 'pol-1', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', enabled: true },
    { id: 'os-mon-1100', policyId: 'pol-1', dayOfWeek: 1, startTime: '11:00', endTime: '12:00', enabled: true },
    { id: 'os-sun-0900', policyId: 'pol-1', dayOfWeek: 0, startTime: '09:00', endTime: '10:00', enabled: true },
    { id: 'os-sun-1000', policyId: 'pol-1', dayOfWeek: 0, startTime: '10:00', endTime: '11:00', enabled: true },
    { id: 'os-disabled', policyId: 'pol-1', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', enabled: false },
  ]);
  await db.insert(schema.profiles).values([
    { id: 'profile-choir', name: 'University Choir', color: '#4F46E5', createdAt: 1 },
    { id: 'profile-jazz', name: 'Jazz Trio', color: '#F59E0B', createdAt: 2 },
  ]);
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
}

const addBooking = (db: DbClient, id: string, roomId: string, profileId: string, startTime: number, status: string) =>
  db.insert(schema.bookings).values({
    id,
    roomId,
    profileId,
    userId: 'user-1',
    startTime,
    endTime: startTime + 60 * 60 * 1000,
    status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
    createdAt: 1,
  });

function findRow(grid: ReturnType<typeof buildWeeklyGrid> extends Promise<infer T> ? T : never, label: string) {
  const row = grid.rows.find((r) => r[0] === label);
  expect(row).toBeDefined();
  return row!;
}

describe('buildWeeklyGrid', () => {
  let db: DbClient;

  beforeEach(async () => {
    db = createTestDb();
    await seed(db);
  });

  it('builds a deterministic tab name and sorted time columns', async () => {
    const grid = await buildWeeklyGrid(db, WEEK_MONDAY);
    expect(grid.tabName).toBe('Week of 2026-08-10');
    expect(grid.weekMonday).toBe(WEEK_MONDAY);
    expect(grid.header).toEqual(['Room / Day', '09:00', '10:00', '11:00']);
    expect(grid.rows).toHaveLength(2 * 7);
  });

  it('places APPROVED bookings in the correct room/day/time cell', async () => {
    await addBooking(
      db,
      'b1',
      'room-main',
      'profile-choir',
      Date.UTC(2026, 7, 10, 9, 0), // Monday 09:00
      'APPROVED',
    );
    await addBooking(
      db,
      'b3',
      'room-acoustic',
      'profile-choir',
      Date.UTC(2026, 7, 11, 9, 0), // Tuesday 09:00
      'APPROVED',
    );
    await addBooking(
      db,
      'b4',
      'room-acoustic',
      'profile-choir',
      Date.UTC(2026, 7, 16, 9, 0), // Sunday 09:00
      'APPROVED',
    );

    const grid = await buildWeeklyGrid(db, WEEK_MONDAY);
    const header = grid.header.slice(1);

    const mon = findRow(grid, 'Main Room - Monday');
    expect(mon[1 + header.indexOf('09:00')]).toBe('University Choir');

    const tue = findRow(grid, 'Acoustic Room - Tuesday');
    expect(tue[1 + header.indexOf('09:00')]).toBe('University Choir');

    const sun = findRow(grid, 'Acoustic Room - Sunday');
    expect(sun[1 + header.indexOf('09:00')]).toBe('University Choir');
  });

  it('excludes non-APPROVED bookings', async () => {
    await addBooking(
      db,
      'b2',
      'room-main',
      'profile-jazz',
      Date.UTC(2026, 7, 10, 9, 0),
      'PENDING',
    );
    await addBooking(
      db,
      'b5',
      'room-main',
      'profile-jazz',
      Date.UTC(2026, 7, 10, 10, 0),
      'REJECTED',
    );

    const grid = await buildWeeklyGrid(db, WEEK_MONDAY);
    const row = findRow(grid, 'Main Room - Monday');
    expect(row.slice(1)).toEqual(['', '', '']);
  });

  it('excludes bookings outside the target week', async () => {
    await addBooking(
      db,
      'b6',
      'room-main',
      'profile-choir',
      Date.UTC(2026, 7, 17, 9, 0), // Monday of the NEXT week
      'APPROVED',
    );
    await addBooking(
      db,
      'b7',
      'room-main',
      'profile-choir',
      Date.UTC(2026, 7, 9, 9, 0), // Sunday of the PREVIOUS week
      'APPROVED',
    );

    const grid = await buildWeeklyGrid(db, WEEK_MONDAY);
    const row = findRow(grid, 'Main Room - Monday');
    expect(row.slice(1)).toEqual(['', '', '']);
  });

  it('is idempotent: repeated builds produce identical grids', async () => {
    await addBooking(
      db,
      'b1',
      'room-main',
      'profile-choir',
      Date.UTC(2026, 7, 10, 9, 0),
      'APPROVED',
    );
    const first = await buildWeeklyGrid(db, WEEK_MONDAY);
    const second = await buildWeeklyGrid(db, WEEK_MONDAY);
    expect(first).toEqual(second);
  });

  it('ignores disabled schedules (no extra columns, no rows for them)', async () => {
    const grid = await buildWeeklyGrid(db, WEEK_MONDAY);
    expect(grid.header).not.toContain('12:00');
    expect(grid.times).not.toContain('12:00');
  });
});
