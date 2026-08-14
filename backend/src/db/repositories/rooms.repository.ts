import { eq } from 'drizzle-orm';
import { DbClient, schema } from '../client.js';

export type Room = typeof schema.rooms.$inferSelect;
export type NewRoom = typeof schema.rooms.$inferInsert;

export interface IRoomsRepository {
  findById(id: string): Promise<Room | null>;
  findByName(name: string): Promise<Room | null>;
  create(room: NewRoom): Promise<Room>;
  update(id: string, data: Partial<Omit<NewRoom, 'id' | 'createdAt'>>): Promise<Room>;
  delete(id: string): Promise<void>;
  list(): Promise<Room[]>;
}

export class DrizzleRoomsRepository implements IRoomsRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Room | null> {
    const results = await this.db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async findByName(name: string): Promise<Room | null> {
    const results = await this.db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.name, name))
      .limit(1);
    return results[0] ?? null;
  }

  async create(room: NewRoom): Promise<Room> {
    const results = await this.db.insert(schema.rooms).values(room).returning();
    if (!results[0]) {
      throw new Error('Failed to create room');
    }
    return results[0];
  }

  async update(id: string, data: Partial<Omit<NewRoom, 'id' | 'createdAt'>>): Promise<Room> {
    const results = await this.db
      .update(schema.rooms)
      .set(data)
      .where(eq(schema.rooms.id, id))
      .returning();
    if (!results[0]) {
      throw new Error(`Room with ID ${id} not found for update`);
    }
    return results[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.rooms).where(eq(schema.rooms.id, id));
  }

  async list(): Promise<Room[]> {
    return this.db.select().from(schema.rooms);
  }
}
