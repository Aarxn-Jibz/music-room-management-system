import { eq, and, lt, gt, ne, inArray } from 'drizzle-orm';
import { DbClient, schema } from '../client.js';

export type Booking = typeof schema.bookings.$inferSelect;
export type NewBooking = typeof schema.bookings.$inferInsert;
export type BookingStatus = Booking['status'];

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'APPROVED'];

export interface IBookingsRepository {
  findById(id: string): Promise<Booking | null>;
  create(booking: NewBooking): Promise<Booking>;
  update(id: string, data: Partial<Omit<NewBooking, 'id' | 'createdAt'>>): Promise<Booking>;
  delete(id: string): Promise<void>;
  list(): Promise<Booking[]>;
  listByRoom(roomId: string): Promise<Booking[]>;
  listByProfile(profileId: string): Promise<Booking[]>;
  listByRoomAndTimeRange(roomId: string, startTime: number, endTime: number): Promise<Booking[]>;
  listActiveByRoomAndTimeRange(roomId: string, startTime: number, endTime: number): Promise<Booking[]>;
  listActiveByTimeRange(startTime: number, endTime: number): Promise<Booking[]>;
  hasActiveConflict(
    roomId: string,
    startTime: number,
    endTime: number,
    excludeBookingId?: string,
  ): Promise<boolean>;
}

export class DrizzleBookingsRepository implements IBookingsRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Booking | null> {
    const results = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async create(booking: NewBooking): Promise<Booking> {
    const results = await this.db.insert(schema.bookings).values(booking).returning();
    if (!results[0]) {
      throw new Error('Failed to create booking');
    }
    return results[0];
  }

  async update(id: string, data: Partial<Omit<NewBooking, 'id' | 'createdAt'>>): Promise<Booking> {
    const results = await this.db
      .update(schema.bookings)
      .set(data)
      .where(eq(schema.bookings.id, id))
      .returning();
    if (!results[0]) {
      throw new Error(`Booking with ID ${id} not found for update`);
    }
    return results[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.bookings).where(eq(schema.bookings.id, id));
  }

  async list(): Promise<Booking[]> {
    return this.db.select().from(schema.bookings);
  }

  async listByRoom(roomId: string): Promise<Booking[]> {
    return this.db.select().from(schema.bookings).where(eq(schema.bookings.roomId, roomId));
  }

  async listByProfile(profileId: string): Promise<Booking[]> {
    return this.db.select().from(schema.bookings).where(eq(schema.bookings.profileId, profileId));
  }

  async listByRoomAndTimeRange(
    roomId: string,
    startTime: number,
    endTime: number,
  ): Promise<Booking[]> {
    return this.db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.roomId, roomId),
          lt(schema.bookings.startTime, endTime),
          gt(schema.bookings.endTime, startTime),
        ),
      );
  }

  async listActiveByRoomAndTimeRange(
    roomId: string,
    startTime: number,
    endTime: number,
  ): Promise<Booking[]> {
    return this.db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.roomId, roomId),
          inArray(schema.bookings.status, ACTIVE_BOOKING_STATUSES),
          lt(schema.bookings.startTime, endTime),
          gt(schema.bookings.endTime, startTime),
        ),
      );
  }

  async listActiveByTimeRange(startTime: number, endTime: number): Promise<Booking[]> {
    return this.db
      .select()
      .from(schema.bookings)
      .where(
        and(
          inArray(schema.bookings.status, ACTIVE_BOOKING_STATUSES),
          lt(schema.bookings.startTime, endTime),
          gt(schema.bookings.endTime, startTime),
        ),
      );
  }

  async hasActiveConflict(
    roomId: string,
    startTime: number,
    endTime: number,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const conditions = [
      eq(schema.bookings.roomId, roomId),
      inArray(schema.bookings.status, ACTIVE_BOOKING_STATUSES),
      lt(schema.bookings.startTime, endTime),
      gt(schema.bookings.endTime, startTime),
    ];
    if (excludeBookingId) {
      conditions.push(ne(schema.bookings.id, excludeBookingId));
    }
    const results = await this.db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(and(...conditions))
      .limit(1);
    return results.length > 0;
  }
}
