import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../test/db.js';
import { RequestsService } from './requests.service.js';
import { schema, DbClient } from '../../db/client.js';
import { User } from '../../db/repositories/users.repository.js';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'member',
    email: 'member@test.local',
    name: 'Member',
    passwordHash: 'x',
    role: 'USER',
    mustChangePassword: false,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('RequestsService', () => {
  let db: DbClient;
  let service: RequestsService;
  const member: User = makeUser();
  const admin: User = makeUser({ id: 'admin-1', username: 'admin', email: 'admin@test.local', role: 'ADMIN' });
  const monday10 = Date.UTC(2026, 7, 17, 10, 0, 0);

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
    await db.insert(schema.profiles).values({
      id: 'band-1',
      name: 'University Choir',
      color: '#4F46E5',
      createdAt: Date.now(),
    });
    await db.insert(schema.operatingSchedules).values({
      id: 'os-1',
      policyId: 'pol-1',
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '11:00',
      enabled: true,
    });
    await db.insert(schema.users).values({
      id: member.id,
      username: member.username,
      email: member.email,
      name: member.name,
      passwordHash: member.passwordHash,
      role: member.role,
      mustChangePassword: false,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.insert(schema.users).values({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      passwordHash: admin.passwordHash,
      role: admin.role,
      mustChangePassword: false,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.insert(schema.userProfiles).values({ userId: member.id, profileId: 'band-1' });
    service = new RequestsService(db);
  });

  const createInput = (start: number) => ({
    user_id: member.id,
    band_id: 'band-1',
    room_id: 'room-1',
    slot_start: new Date(start).toISOString(),
    slot_end: new Date(start + 90 * 60 * 1000).toISOString(),
    reason: 'rehearsal',
  });

  it('creates a pending request for an exact configured slot (10:00-11:30 normalizes to 11:00)', async () => {
    const request = await service.create(member, createInput(monday10));
    expect(request.status).toBe('pending');
    expect(request.slot_start).toBe(new Date(monday10).toISOString());
    expect(request.slot_end).toBe('2026-08-17T11:00:00.000Z');
    expect(request.band_name).toBe('University Choir');
  });

  it('rejects a start that is not on a slot boundary (10:30)', async () => {
    await expect(service.create(member, createInput(monday10 + 30 * 60 * 1000))).rejects.toThrow('BAD_REQUEST');
  });

  it('rejects a booking beyond the booking horizon', async () => {
    const farFuture = monday10 + 30 * 24 * 60 * 60 * 1000;
    await expect(service.create(member, createInput(farFuture))).rejects.toThrow('BAD_REQUEST');
  });

  it('rejects a band the user does not belong to', async () => {
    await db.insert(schema.profiles).values({
      id: 'band-other',
      name: 'Other Band',
      color: '#111111',
      createdAt: Date.now(),
    });
    const input = createInput(monday10);
    input.band_id = 'band-other';
    await expect(service.create(member, input)).rejects.toThrow('FORBIDDEN');
  });

  it('allows an admin to book on behalf of any band', async () => {
    await db.insert(schema.profiles).values({
      id: 'band-other',
      name: 'Other Band',
      color: '#111111',
      createdAt: Date.now(),
    });
    const input = createInput(monday10);
    input.band_id = 'band-other';
    const request = await service.create(admin, input);
    expect(request.status).toBe('pending');
  });

  it('rejects a duplicate booking of the same room+slot with the conflict band name', async () => {
    await service.create(member, createInput(monday10));
    await expect(service.create(member, createInput(monday10))).rejects.toThrow('CONFLICT:University Choir');
  });

  it('allows the same slot on a different room', async () => {
    await db.insert(schema.rooms).values({
      id: 'room-2',
      name: 'Acoustic Room',
      number: 2,
      createdAt: Date.now(),
      active: true,
      policyId: 'pol-1',
    });
    await service.create(member, createInput(monday10));
    const input = createInput(monday10);
    input.room_id = 'room-2';
    const request = await service.create(member, input);
    expect(request.room_id).toBe('room-2');
  });

  it('prevents a non-admin from approving a request', async () => {
    const request = await service.create(member, createInput(monday10));
    await expect(service.update(member, request.id, { status: 'approved' }, false)).rejects.toThrow('FORBIDDEN');
  });

  it('allows an admin to approve a request', async () => {
    const request = await service.create(member, createInput(monday10));
    const updated = await service.update(admin, request.id, { status: 'approved' }, true);
    expect(updated.status).toBe('approved');
    expect(updated.response_date).not.toBeNull();
  });

  it('allows an owner to edit their own request reason', async () => {
    const request = await service.create(member, createInput(monday10));
    const updated = await service.update(member, request.id, { reason: 'changed' }, false);
    expect(updated.reason).toBe('changed');
    expect(updated.status).toBe('pending');
  });

  it('rejects approving a booking moved into a slot occupied by another active booking', async () => {
    await db.insert(schema.operatingSchedules).values({
      id: 'os-2',
      policyId: 'pol-1',
      dayOfWeek: 1,
      startTime: '11:00',
      endTime: '12:00',
      enabled: true,
    });
    const first = await service.create(member, createInput(monday10));
    await service.update(admin, first.id, { status: 'approved' }, true);

    await db.insert(schema.users).values({
      id: 'user-2',
      username: 'member2',
      email: 'm2@test.local',
      name: 'Member Two',
      passwordHash: 'x',
      role: 'USER',
      mustChangePassword: false,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.insert(schema.userProfiles).values({ userId: 'user-2', profileId: 'band-1' });

    const secondInput = createInput(monday10 + 60 * 60 * 1000);
    secondInput.user_id = 'user-2';
    const second = await service.create(makeUser({ id: 'user-2' }), secondInput);
    expect(second.slot_start).toBe('2026-08-17T11:00:00.000Z');

    await expect(
      service.update(
        admin,
        second.id,
        {
          status: 'approved',
          slot_start: new Date(monday10).toISOString(),
          slot_end: new Date(monday10 + 90 * 60 * 1000).toISOString(),
        },
        true,
      ),
    ).rejects.toThrow('CONFLICT');
  });

  it('removes a request and records an audit log', async () => {
    const request = await service.create(member, createInput(monday10));
    const result = await service.remove(admin, request.id);
    expect(result).toEqual({ message: 'Request deleted successfully' });
    const logs = await db.select().from(schema.auditLogs);
    expect(logs.length).toBeGreaterThan(0);
  });
});
