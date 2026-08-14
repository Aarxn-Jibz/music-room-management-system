import { and, eq, lt, gt, inArray } from 'drizzle-orm';
import { DbClient, schema } from '../../db/client.js';
import { ACTIVE_BOOKING_STATUSES } from '../../db/repositories/bookings.repository.js';

export interface BookedSlotDTO {
  id: string;
  status: 'booked';
  band_id: string;
  room_id: string;
  slot_start: string;
  slot_end: string;
  band_name: string;
  room_number: number | null;
  room_name: string;
}

export interface SlotsQuery {
  start?: number;
  end?: number;
  roomNumber?: number;
}

export class SlotsService {
  constructor(private db: DbClient) {}

  async listBookedSlots(query: SlotsQuery): Promise<BookedSlotDTO[]> {
    let start = query.start ?? this.weekStart();
    let end = query.end ?? start + 7 * 24 * 60 * 60 * 1000;

    if (end <= start) {
      end = start + 7 * 24 * 60 * 60 * 1000;
    }

    let room: typeof schema.rooms.$inferSelect | undefined;
    if (query.roomNumber !== undefined) {
      const rooms = await this.db
        .select()
        .from(schema.rooms)
        .where(eq(schema.rooms.number, query.roomNumber))
        .limit(1);
      room = rooms[0];
      if (!room) {
        return [];
      }
    }

    const conditions = [
      inArray(schema.bookings.status, ACTIVE_BOOKING_STATUSES),
      lt(schema.bookings.startTime, end),
      gt(schema.bookings.endTime, start),
    ];
    if (room) {
      conditions.push(eq(schema.bookings.roomId, room.id));
    }

    const results = await this.db
      .select({
        id: schema.bookings.id,
        roomId: schema.bookings.roomId,
        profileId: schema.bookings.profileId,
        startTime: schema.bookings.startTime,
        endTime: schema.bookings.endTime,
        bandName: schema.profiles.name,
        roomNumber: schema.rooms.number,
        roomName: schema.rooms.name,
      })
      .from(schema.bookings)
      .innerJoin(schema.profiles, eq(schema.bookings.profileId, schema.profiles.id))
      .innerJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
      .where(and(...conditions));

    return results.map((row) => ({
      id: row.id,
      status: 'booked' as const,
      band_id: row.profileId,
      room_id: row.roomId,
      slot_start: new Date(row.startTime).toISOString(),
      slot_end: new Date(row.endTime).toISOString(),
      band_name: row.bandName,
      room_number: row.roomNumber,
      room_name: row.roomName,
    }));
  }

  private weekStart(): number {
    const now = new Date();
    const day = now.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    now.setUTCDate(now.getUTCDate() - daysSinceMonday);
    now.setUTCHours(0, 0, 0, 0);
    return now.getTime();
  }
}
