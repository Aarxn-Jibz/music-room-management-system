import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../test/db.js';
import { SlotPolicyService } from './slot-policy.service.js';
import { schema, DbClient } from '../../db/client.js';

describe('SlotPolicyService', () => {
  let db: DbClient;

  beforeEach(async () => {
    db = createTestDb();
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
      id: 'room-1',
      name: 'Main Room',
      number: 1,
      createdAt: Date.now(),
      active: true,
      policyId: 'pol-1',
    });
  });

  const addSlot = (start: string, end: string, enabled = true, dayOfWeek = 1) =>
    db.insert(schema.operatingSchedules).values({
      id: `os-${dayOfWeek}-${start}`,
      policyId: 'pol-1',
      dayOfWeek,
      startTime: start,
      endTime: end,
      enabled,
    });

  describe('findExactSlot', () => {
    // 2026-08-17 is a Monday (dayOfWeek 1)
    const monday10 = Date.UTC(2026, 7, 17, 10, 0, 0);

    it('matches an exact configured slot start and normalizes the end', async () => {
      await addSlot('10:00', '11:00');
      const svc = new SlotPolicyService(db);
      const slot = await svc.findExactSlot('room-1', monday10);
      expect(slot).toEqual({
        startTime: Date.UTC(2026, 7, 17, 10, 0, 0),
        endTime: Date.UTC(2026, 7, 17, 11, 0, 0),
      });
    });

    it('rejects a start that is not on a configured slot boundary (10:30)', async () => {
      await addSlot('10:00', '11:00');
      const svc = new SlotPolicyService(db);
      expect(await svc.findExactSlot('room-1', Date.UTC(2026, 7, 17, 10, 30, 0))).toBeNull();
    });

    it('rejects a start with sub-minute precision', async () => {
      await addSlot('10:00', '11:00');
      const svc = new SlotPolicyService(db);
      expect(await svc.findExactSlot('room-1', Date.UTC(2026, 7, 17, 10, 0, 30))).toBeNull();
    });

    it('rejects a disabled slot', async () => {
      await addSlot('10:00', '11:00', false);
      const svc = new SlotPolicyService(db);
      expect(await svc.findExactSlot('room-1', monday10)).toBeNull();
    });

    it('rejects a start on a weekday with no configured slot', async () => {
      await addSlot('10:00', '11:00', true, 2);
      const svc = new SlotPolicyService(db);
      expect(await svc.findExactSlot('room-1', monday10)).toBeNull();
    });

    it('rejects a start when the time has no matching slot at all', async () => {
      await addSlot('14:00', '15:00');
      const svc = new SlotPolicyService(db);
      expect(await svc.findExactSlot('room-1', monday10)).toBeNull();
    });
  });

  describe('bookingHorizonMs', () => {
    it('returns the configured horizon in milliseconds', async () => {
      const svc = new SlotPolicyService(db);
      expect(await svc.bookingHorizonMs('room-1')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('defaults to 7 days when the policy is missing', async () => {
      await db.delete(schema.systemSettings).run();
      await db.delete(schema.rooms).run();
      await db.delete(schema.bookingPolicies).run();
      const svc = new SlotPolicyService(db);
      expect(await svc.bookingHorizonMs('room-1')).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
