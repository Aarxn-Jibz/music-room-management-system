import { eq } from 'drizzle-orm';
import { DbClient, schema } from '../../db/client.js';
import { CreateBandInput, UpdateBandInput } from '../../schemas.js';

export interface BandDTO {
  id: string;
  name: string;
  colour: string;
}

function toBandDTO(band: typeof schema.profiles.$inferSelect): BandDTO {
  return {
    id: band.id,
    name: band.name,
    colour: band.color,
  };
}

export class BandsService {
  constructor(private db: DbClient) {}

  async list(): Promise<BandDTO[]> {
    const bands = await this.db
      .select()
      .from(schema.profiles)
      .orderBy(schema.profiles.name);
    return bands.map(toBandDTO);
  }

  async create(data: CreateBandInput): Promise<BandDTO> {
    const now = Date.now();
    const results = await this.db
      .insert(schema.profiles)
      .values({
        id: crypto.randomUUID(),
        name: data.name,
        color: data.colour ?? '#4F46E5',
        createdAt: now,
      })
      .returning();
    if (!results[0]) {
      throw new Error('FAILED');
    }
    return toBandDTO(results[0]);
  }

  async update(id: string, data: UpdateBandInput): Promise<BandDTO> {
    const existing = await this.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }

    const updates: Partial<typeof schema.profiles.$inferInsert> = {};
    if (data.name !== undefined) {
      updates.name = data.name;
    }
    if (data.colour !== undefined) {
      updates.color = data.colour;
    }

    const results = await this.db
      .update(schema.profiles)
      .set(updates)
      .where(eq(schema.profiles.id, id))
      .returning();
    if (!results[0]) {
      throw new Error('FAILED');
    }
    return toBandDTO(results[0]);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }
    await this.db.delete(schema.profiles).where(eq(schema.profiles.id, id));
  }
}
