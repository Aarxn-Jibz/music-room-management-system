import { and, eq, ne, lt, gt, inArray, desc } from 'drizzle-orm';
import { BatchItem } from 'drizzle-orm/batch';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import { DbClient, schema } from '../../db/client.js';
import { ACTIVE_BOOKING_STATUSES } from '../../db/repositories/bookings.repository.js';
import { SlotPolicyService } from './slot-policy.service.js';
import { writeAuditLog } from '../../audit/index.js';
import { CreateRequestInput, UpdateRequestInput } from '../../schemas.js';
import { User } from '../../db/repositories/users.repository.js';
import { BookingNotifier, BookingNotificationEvent } from '../../email/index.js';

export type RequestStatusApi = 'pending' | 'approved' | 'denied';

export type TransactionClient = SQLiteTransaction<
  'async',
  D1Result<unknown>,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export interface RequestDTO {
  id: string;
  user_id: string;
  status: RequestStatusApi;
  slot_start: string;
  slot_end: string;
  request_date: string;
  response_date: string | null;
  user_name?: string;
  band_name?: string;
  reason?: string;
  room_id: string;
}

interface BookingRow {
  id: string;
  userId: string;
  roomId: string;
  profileId: string;
  status: string;
  slotStart: number;
  slotEnd: number;
  createdAt: number;
  approvedAt: number | null;
  reason: string | null;
  userName: string;
  bandName: string;
}

function mapStatusToApi(status: string): RequestStatusApi {
  if (status === 'APPROVED') {
    return 'approved';
  }
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return 'denied';
  }
  return 'pending';
}

function mapStatusFromApi(status: 'approved' | 'denied' | 'pending'): 'APPROVED' | 'REJECTED' | 'PENDING' {
  if (status === 'approved') {
    return 'APPROVED';
  }
  if (status === 'denied') {
    return 'REJECTED';
  }
  return 'PENDING';
}

function toDTO(row: BookingRow): RequestDTO {
  return {
    id: row.id,
    user_id: row.userId,
    status: mapStatusToApi(row.status),
    slot_start: new Date(row.slotStart).toISOString(),
    slot_end: new Date(row.slotEnd).toISOString(),
    request_date: new Date(row.createdAt).toISOString(),
    response_date: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    user_name: row.userName,
    band_name: row.bandName,
    reason: row.reason ?? undefined,
    room_id: row.roomId,
  };
}

export class RequestsService {
  private policyService: SlotPolicyService;

  constructor(
    private db: DbClient,
    private notifier?: BookingNotifier,
  ) {
    this.policyService = new SlotPolicyService(db);
  }

  private dispatchNotification(kind: BookingNotificationEvent['kind'], dto: RequestDTO): Promise<void> {
    if (!this.notifier) {
      return Promise.resolve();
    }
    return this.notifier
      .notify({
        kind,
        booking: {
          id: dto.id,
          status: dto.status,
          slot_start: dto.slot_start,
          slot_end: dto.slot_end,
          room_id: dto.room_id,
          user_name: dto.user_name,
          band_name: dto.band_name,
          reason: dto.reason,
        },
      })
      .catch(() => {});
  }

  async list(params: { roomId?: string; userId?: string }): Promise<RequestDTO[]> {
    const conditions = [];
    if (params.roomId) {
      conditions.push(eq(schema.bookings.roomId, params.roomId));
    }
    if (params.userId) {
      conditions.push(eq(schema.bookings.userId, params.userId));
    }

    const query = this.db
      .select({
        id: schema.bookings.id,
        userId: schema.bookings.userId,
        roomId: schema.bookings.roomId,
        profileId: schema.bookings.profileId,
        status: schema.bookings.status,
        slotStart: schema.bookings.startTime,
        slotEnd: schema.bookings.endTime,
        createdAt: schema.bookings.createdAt,
        approvedAt: schema.bookings.approvedAt,
        reason: schema.bookings.reason,
        userName: schema.users.name,
        bandName: schema.profiles.name,
      })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.bookings.userId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.bookings.profileId, schema.profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.bookings.createdAt));

    const rows = await query;
    return rows.map((r) => toDTO(r as unknown as BookingRow));
  }

  async getById(id: string): Promise<RequestDTO | null> {
    const rows = await this.db
      .select({
        id: schema.bookings.id,
        userId: schema.bookings.userId,
        roomId: schema.bookings.roomId,
        profileId: schema.bookings.profileId,
        status: schema.bookings.status,
        slotStart: schema.bookings.startTime,
        slotEnd: schema.bookings.endTime,
        createdAt: schema.bookings.createdAt,
        approvedAt: schema.bookings.approvedAt,
        reason: schema.bookings.reason,
        userName: schema.users.name,
        bandName: schema.profiles.name,
      })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.bookings.userId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.bookings.profileId, schema.profiles.id))
      .where(eq(schema.bookings.id, id))
      .limit(1);

    if (!rows[0]) {
      return null;
    }
    return toDTO(rows[0] as unknown as BookingRow);
  }

  async create(actor: User, input: CreateRequestInput): Promise<RequestDTO> {
    const now = Date.now();
    const startTime = Date.parse(input.slot_start);
    const endTime = Date.parse(input.slot_end);

    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
      throw new Error('BAD_REQUEST: Invalid slot times');
    }
    if (startTime <= now) {
      throw new Error('BAD_REQUEST: Booking must be in the future');
    }
    if (endTime <= startTime) {
      throw new Error('BAD_REQUEST: End time must be after start time');
    }

    if (actor.role !== 'ADMIN' && actor.id !== input.user_id) {
      throw new Error('FORBIDDEN: You cannot create a booking on behalf of another user');
    }

    const room = await this.findRoom(input.room_id);
    if (!room) {
      throw new Error('BAD_REQUEST: Room does not exist');
    }
    if (!room.active) {
      throw new Error('BAD_REQUEST: Room is inactive');
    }

    const profile = await this.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, input.band_id))
      .limit(1);
    if (!profile[0]) {
      throw new Error('BAD_REQUEST: Band does not exist');
    }

    if (actor.role !== 'ADMIN') {
      const membership = await this.db
        .select()
        .from(schema.userProfiles)
        .where(
          and(
            eq(schema.userProfiles.userId, input.user_id),
            eq(schema.userProfiles.profileId, input.band_id),
          ),
        )
        .limit(1);
      if (!membership[0]) {
        throw new Error('FORBIDDEN: User does not belong to the selected band');
      }
    }

    const exactSlot = await this.policyService.findExactSlot(room.id, startTime);
    if (!exactSlot) {
      throw new Error('BAD_REQUEST: Slot is not available for booking');
    }

    const horizonMs = await this.policyService.bookingHorizonMs(room.id);
    if (startTime > now + horizonMs) {
      throw new Error('BAD_REQUEST: Booking date exceeds the maximum booking horizon');
    }

    const bookingId = crypto.randomUUID();
    try {
      const conflict = await this.findActiveConflict(this.db, room.id, exactSlot.startTime, exactSlot.endTime);
      if (conflict) {
        throw new Error(`CONFLICT:${conflict.band_name}`);
      }

      await this.db.batch([
        this.db.insert(schema.bookings).values({
          id: bookingId,
          roomId: room.id,
          profileId: input.band_id,
          userId: input.user_id,
          startTime: exactSlot.startTime,
          endTime: exactSlot.endTime,
          status: 'PENDING',
          reason: input.reason ?? null,
          createdAt: now,
        }),
        this.db.insert(schema.auditLogs).values({
          id: crypto.randomUUID(),
          actorId: actor.id,
          action: 'CREATE_BOOKING',
          targetType: 'BOOKING',
          targetId: bookingId,
          metadata: JSON.stringify({
            roomId: room.id,
            profileId: input.band_id,
            startTime: exactSlot.startTime,
            endTime: exactSlot.endTime,
          }),
          createdAt: now,
        }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('CONFLICT:')) {
        throw new Error(`CONFLICT:${msg.split(':')[1]}`);
      }
      if (msg.includes('UNIQUE constraint failed: bookings.room_id')) {
        throw new Error('CONFLICT:');
      }
      throw err;
    }

    const created = await this.getById(bookingId);
    if (!created) {
      throw new Error('INTERNAL');
    }
    await this.dispatchNotification('created', created);
    return created;
  }

  async update(
    actor: User,
    id: string,
    data: UpdateRequestInput,
    isAdmin: boolean,
  ): Promise<RequestDTO> {
    const existing = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }
    const booking = existing[0];

    const statusChanging = data.status !== undefined && mapStatusFromApi(data.status) !== booking.status;
    if (statusChanging && !isAdmin) {
      throw new Error('FORBIDDEN: Only admins can change request status');
    }
    if (!statusChanging && actor.role !== 'ADMIN' && actor.id !== booking.userId) {
      throw new Error('FORBIDDEN');
    }

    const now = Date.now();

    const slotChanging = data.slot_start !== undefined || data.slot_end !== undefined;
    const roomId = data.room_id ?? booking.roomId;

    let startTime = booking.startTime;
    let endTime = booking.endTime;
    if (data.slot_start !== undefined) {
      const parsed = Date.parse(data.slot_start);
      if (Number.isNaN(parsed)) {
        throw new Error('BAD_REQUEST: Invalid slot start time');
      }
      startTime = parsed;
    }
    if (data.slot_end !== undefined) {
      const parsed = Date.parse(data.slot_end);
      if (Number.isNaN(parsed)) {
        throw new Error('BAD_REQUEST: Invalid slot end time');
      }
      endTime = parsed;
    }

    if (slotChanging || data.room_id !== undefined) {
      if (startTime <= now) {
        throw new Error('BAD_REQUEST: Booking must be in the future');
      }
      const room = await this.findRoom(roomId);
      if (!room) {
        throw new Error('BAD_REQUEST: Room does not exist');
      }
      const exactSlot = await this.policyService.findExactSlot(room.id, startTime);
      if (!exactSlot) {
        throw new Error('BAD_REQUEST: Slot is not available for booking');
      }
      startTime = exactSlot.startTime;
      endTime = exactSlot.endTime;
    }

    if (endTime <= startTime) {
      throw new Error('BAD_REQUEST: End time must be after start time');
    }

    const updates: Partial<typeof schema.bookings.$inferInsert> = {};

    if (data.status !== undefined) {
      const targetStatus = mapStatusFromApi(data.status);
      updates.status = targetStatus;
      if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
        updates.approvedBy = actor.id;
        updates.approvedAt = now;
      } else {
        updates.approvedBy = null;
        updates.approvedAt = null;
      }
    }
    if (data.reason !== undefined) {
      updates.reason = data.reason;
    }
    if (data.room_id !== undefined) {
      updates.roomId = data.room_id;
    }
    if (data.band_id !== undefined) {
      updates.profileId = data.band_id;
    }
    if (slotChanging) {
      updates.startTime = startTime;
      updates.endTime = endTime;
    }

    const newStatus = updates.status ?? booking.status;
    const newRoomId = updates.roomId ?? booking.roomId;
    const newStart = updates.startTime ?? booking.startTime;
    const newEnd = updates.endTime ?? booking.endTime;

    try {
      if (newStatus === 'APPROVED') {
        const conflict = await this.findActiveConflict(this.db, newRoomId, newStart, newEnd, id);
        if (conflict) {
          throw new Error(`CONFLICT:${conflict.band_name}`);
        }
      } else if (slotChanging && newStatus !== 'REJECTED') {
        // Pending bookings also occupy the slot: enforce the invariant when moving slots
        const conflict = await this.findActiveConflict(this.db, newRoomId, newStart, newEnd, id);
        if (conflict) {
          throw new Error(`CONFLICT:${conflict.band_name}`);
        }
      }

      const batch: BatchItem<'sqlite'>[] = [];
      if (Object.keys(updates).length > 0) {
        batch.push(this.db.update(schema.bookings).set(updates).where(eq(schema.bookings.id, id)));
      }
      batch.push(
        this.db.insert(schema.auditLogs).values({
          id: crypto.randomUUID(),
          actorId: actor.id,
          action: 'UPDATE_REQUEST',
          targetType: 'BOOKING',
          targetId: id,
          metadata: JSON.stringify({
            status: newStatus,
            roomId: newRoomId,
            startTime: newStart,
            endTime: newEnd,
          }),
          createdAt: now,
        }),
      );
      await this.db.batch(batch as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('CONFLICT:')) {
        throw new Error(msg);
      }
      if (msg.includes('UNIQUE constraint failed: bookings.room_id')) {
        throw new Error('CONFLICT:');
      }
      throw err;
    }

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('INTERNAL');
    }
    if (updated.status === 'approved') {
      await this.dispatchNotification('approved', updated);
    } else if (updated.status === 'denied') {
      await this.dispatchNotification('denied', updated);
    }
    return updated;
  }

  async remove(actor: User, id: string): Promise<{ message: string }> {
    const existing = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }
    if (actor.role !== 'ADMIN' && actor.id !== existing[0].userId) {
      throw new Error('FORBIDDEN');
    }

    await this.db.delete(schema.bookings).where(eq(schema.bookings.id, id));
    await writeAuditLog(this.db, actor.id, 'DELETE_REQUEST', 'BOOKING', id, {});
    return { message: 'Request deleted successfully' };
  }

  private async findRoom(roomId: string) {
    const rows = await this.db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.id, roomId))
      .limit(1);
    return rows[0] ?? null;
  }

  private async findActiveConflict(
    tx: DbClient | TransactionClient,
    roomId: string,
    startTime: number,
    endTime: number,
    excludeBookingId?: string,
  ): Promise<{ id: string; band_name: string } | null> {
    const conditions = [
      eq(schema.bookings.roomId, roomId),
      inArray(schema.bookings.status, ACTIVE_BOOKING_STATUSES),
      lt(schema.bookings.startTime, endTime),
      gt(schema.bookings.endTime, startTime),
    ];
    if (excludeBookingId) {
      conditions.push(ne(schema.bookings.id, excludeBookingId));
    }
    const rows = await tx
      .select({
        id: schema.bookings.id,
        bandName: schema.profiles.name,
      })
      .from(schema.bookings)
      .innerJoin(schema.profiles, eq(schema.bookings.profileId, schema.profiles.id))
      .where(and(...conditions))
      .limit(1);
    return rows[0] ? { id: rows[0].id, band_name: rows[0].bandName } : null;
  }
}
