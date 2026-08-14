import { and, eq, gte, lt, inArray } from 'drizzle-orm';
import { DbClient } from '../db/client.js';
import { schema } from '../db/client.js';
import {
  MS_PER_DAY,
  dayIndexWithinWeek,
  formatHhMm,
  formatWeekLabel,
  hhMmToMs,
  utcDayForGridIndex,
  utcDayName,
} from './time.js';

export interface WeeklyGrid {
  weekMonday: number;
  tabName: string;
  header: string[];
  rows: string[][];
  times: string[];
}

export interface GridBooking {
  roomId: string;
  bandName: string;
  startTime: number;
}

/**
 * Builds the deterministic weekly grid for the UTC week starting at `weekMonday`.
 * Rows are "<room> - <day>", columns are configured time slots (HH:MM).
 * Cells contain the band name for APPROVED bookings only; everything else is "".
 */
export async function buildWeeklyGrid(db: DbClient, weekMonday: number): Promise<WeeklyGrid> {
  const weekStart = weekMonday;
  const weekEnd = weekMonday + MS_PER_DAY * 7;

  const settings = await db.select().from(schema.systemSettings).limit(1);
  const defaultPolicyId = settings[0]?.defaultPolicyId;

  const rooms = await db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.active, true));

  const policyIds = [...new Set(rooms.map((r) => r.policyId ?? defaultPolicyId))];
  const schedules = await db
    .select()
    .from(schema.operatingSchedules)
    .where(
      and(
        eq(schema.operatingSchedules.enabled, true),
        inArray(schema.operatingSchedules.policyId, policyIds),
      ),
    );

  const schedulesByPolicy = new Map<string, (typeof schedules)[number][]>();
  for (const schedule of schedules) {
    const list = schedulesByPolicy.get(schedule.policyId) ?? [];
    list.push(schedule);
    schedulesByPolicy.set(schedule.policyId, list);
  }

  const bookings = await db
    .select({
      roomId: schema.bookings.roomId,
      startTime: schema.bookings.startTime,
      bandName: schema.profiles.name,
    })
    .from(schema.bookings)
    .innerJoin(schema.profiles, eq(schema.bookings.profileId, schema.profiles.id))
    .where(
      and(
        eq(schema.bookings.status, 'APPROVED'),
        gte(schema.bookings.startTime, weekStart),
        lt(schema.bookings.startTime, weekEnd),
      ),
    );

  const times = [
    ...new Set(
      schedules
        .map((s) => s.startTime)
        .filter((t): t is string => typeof t === 'string'),
    ),
  ].sort((a, b) => hhMmToMs(a) - hhMmToMs(b));

  const dayStart = (gridIndex: number) => weekStart + gridIndex * MS_PER_DAY;

  const cellByKey = new Map<string, string>();
  for (const booking of bookings) {
    const gridIndex = dayIndexWithinWeek(new Date(booking.startTime).getUTCDay());
    const time = formatHhMm(booking.startTime);
    const key = `${booking.roomId}|${gridIndex}|${time}`;
    const existing = cellByKey.get(key);
    cellByKey.set(key, existing ? `${existing}, ${booking.bandName}` : booking.bandName);
  }

  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  const rows: string[][] = [];
  for (const room of sortedRooms) {
    const policySchedules = schedulesByPolicy.get(room.policyId ?? defaultPolicyId) ?? [];
    for (let gridIndex = 0; gridIndex < 7; gridIndex++) {
      const utcDay = utcDayForGridIndex(gridIndex);
      const label = `${room.name} - ${utcDayName(utcDay)}`;
      const cells = times.map((time) => {
        const startMs = dayStart(gridIndex) + hhMmToMs(time);
        return cellByKey.get(`${room.id}|${gridIndex}|${time}`) ?? '';
      });
      rows.push([label, ...cells]);
    }
  }

  return {
    weekMonday,
    tabName: formatWeekLabel(weekMonday),
    header: ['Room / Day', ...times],
    rows,
    times,
  };
}
