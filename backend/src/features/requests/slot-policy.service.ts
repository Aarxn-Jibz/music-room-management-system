import { and, eq } from 'drizzle-orm';
import { DbClient, schema } from '../../db/client.js';

const FALLBACK_POLICY_ID = 'default-policy-uuid-0000-0000-000000000000';

export interface ExactSlot {
  startTime: number;
  endTime: number;
}

export class SlotPolicyService {
  constructor(private db: DbClient) {}

  private async defaultPolicyId(): Promise<string> {
    const settings = await this.db.select().from(schema.systemSettings).limit(1);
    return settings[0]?.defaultPolicyId ?? FALLBACK_POLICY_ID;
  }

  async resolvePolicyId(roomId: string): Promise<string> {
    const rooms = await this.db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.id, roomId))
      .limit(1);
    if (!rooms[0]) {
      return FALLBACK_POLICY_ID;
    }
    return rooms[0].policyId ?? (await this.defaultPolicyId());
  }

  /**
   * Finds the exact configured slot whose wall-clock (UTC) start matches the given epoch.
   * Only enabled slots qualify. Returns the normalized start/end epochs, or null when the
   * requested time does not correspond to an exact configured slot (e.g. 10:30-11:30).
   */
  async findExactSlot(roomId: string, startTime: number): Promise<ExactSlot | null> {
    const policyId = await this.resolvePolicyId(roomId);

    const d = new Date(startTime);
    const dayOfWeek = d.getUTCDay();
    const startMins = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

    const schedules = await this.db
      .select()
      .from(schema.operatingSchedules)
      .where(
        and(
          eq(schema.operatingSchedules.policyId, policyId),
          eq(schema.operatingSchedules.dayOfWeek, dayOfWeek),
          eq(schema.operatingSchedules.enabled, true),
          eq(schema.operatingSchedules.startTime, startMins),
        ),
      )
      .limit(1);

    const schedule = schedules[0];
    if (!schedule) {
      return null;
    }

    const [endHours, endMins] = schedule.endTime.split(':').map((v) => parseInt(v, 10));

    const normalizedStart = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      0,
      0,
    );
    if (normalizedStart !== startTime) {
      return null;
    }

    const normalizedEnd = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      endHours ?? 0,
      endMins ?? 0,
      0,
      0,
    );

    return { startTime: normalizedStart, endTime: normalizedEnd };
  }

  async bookingHorizonMs(roomId: string): Promise<number> {
    const policyId = await this.resolvePolicyId(roomId);
    const policies = await this.db
      .select()
      .from(schema.bookingPolicies)
      .where(eq(schema.bookingPolicies.id, policyId))
      .limit(1);
    const days = policies[0]?.bookingHorizonDays ?? 7;
    return days * 24 * 60 * 60 * 1000;
  }
}
