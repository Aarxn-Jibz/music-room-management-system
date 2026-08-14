import { and, eq } from 'drizzle-orm';
import { DbClient, schema } from '../../db/client.js';
import { SlotConfigCreateInput, SlotConfigUpdateInput } from '../../schemas.js';

const FALLBACK_POLICY_ID = 'default-policy-uuid-0000-0000-000000000000';

export interface SlotConfigDTO {
  id: string;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

export class SlotConfigService {
  constructor(private db: DbClient) {}

  private async defaultPolicyId(): Promise<string> {
    const settings = await this.db.select().from(schema.systemSettings).limit(1);
    return settings[0]?.defaultPolicyId ?? FALLBACK_POLICY_ID;
  }

  async listDistinctSlots(): Promise<SlotConfigDTO[]> {
    const policyId = await this.defaultPolicyId();
    const rows = await this.db
      .select()
      .from(schema.operatingSchedules)
      .where(eq(schema.operatingSchedules.policyId, policyId));

    const seen = new Map<string, SlotConfigDTO>();
    for (const row of rows) {
      const key = `${row.startTime}|${row.endTime}`;
      if (!seen.has(key)) {
        seen.set(key, {
          id: row.id,
          start_time: row.startTime,
          end_time: row.endTime,
          enabled: row.enabled,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  async createSlot(data: SlotConfigCreateInput): Promise<SlotConfigDTO> {
    const policyId = await this.defaultPolicyId();
    const startTime = data.start_time;
    const endTime = data.end_time;
    const enabled = data.enabled ?? true;

    const existing = await this.db
      .select()
      .from(schema.operatingSchedules)
      .where(
        and(
          eq(schema.operatingSchedules.policyId, policyId),
          eq(schema.operatingSchedules.startTime, startTime),
          eq(schema.operatingSchedules.endTime, endTime),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return {
        id: existing[0].id,
        start_time: existing[0].startTime,
        end_time: existing[0].endTime,
        enabled: existing[0].enabled,
      };
    }

    const rows = Array.from({ length: 7 }, (_, day) => ({
      id: crypto.randomUUID(),
      policyId,
      dayOfWeek: day,
      startTime,
      endTime,
      enabled,
    }));
    await this.db.insert(schema.operatingSchedules).values(rows);

    return { id: rows[0].id, start_time: startTime, end_time: endTime, enabled };
  }

  async updateSlot(id: string, data: SlotConfigUpdateInput): Promise<{ message: string }> {
    const policyId = await this.defaultPolicyId();
    const existing = await this.db
      .select()
      .from(schema.operatingSchedules)
      .where(eq(schema.operatingSchedules.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }

    const oldStart = existing[0].startTime;
    const oldEnd = existing[0].endTime;

    const updates: Partial<typeof schema.operatingSchedules.$inferInsert> = {};
    if (data.start_time !== undefined) {
      updates.startTime = data.start_time;
    }
    if (data.end_time !== undefined) {
      updates.endTime = data.end_time;
    }
    if (data.enabled !== undefined) {
      updates.enabled = data.enabled;
    }

    if (Object.keys(updates).length === 0) {
      return { message: 'Slot config updated' };
    }

    await this.db
      .update(schema.operatingSchedules)
      .set(updates)
      .where(
        and(
          eq(schema.operatingSchedules.policyId, policyId),
          eq(schema.operatingSchedules.startTime, oldStart),
          eq(schema.operatingSchedules.endTime, oldEnd),
        ),
      );

    return { message: 'Slot config updated' };
  }

  async deleteSlot(id: string): Promise<{ message: string }> {
    const policyId = await this.defaultPolicyId();
    const existing = await this.db
      .select()
      .from(schema.operatingSchedules)
      .where(eq(schema.operatingSchedules.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }

    await this.db
      .delete(schema.operatingSchedules)
      .where(
        and(
          eq(schema.operatingSchedules.policyId, policyId),
          eq(schema.operatingSchedules.startTime, existing[0].startTime),
          eq(schema.operatingSchedules.endTime, existing[0].endTime),
        ),
      );

    return { message: 'Slot config deleted' };
  }
}
