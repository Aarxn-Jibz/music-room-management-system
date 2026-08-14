import { eq } from 'drizzle-orm';
import { DbClient, schema } from '../client.js';

export type Session = typeof schema.sessions.$inferSelect;
export type NewSession = typeof schema.sessions.$inferInsert;

export interface ISessionsRepository {
  findById(id: string): Promise<Session | null>;
  create(session: NewSession): Promise<Session>;
  update(id: string, data: Partial<Omit<NewSession, 'id' | 'createdAt'>>): Promise<Session>;
  delete(id: string): Promise<void>;
  listByUserId(userId: string): Promise<Session[]>;
}

export class DrizzleSessionsRepository implements ISessionsRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Session | null> {
    const results = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async create(session: NewSession): Promise<Session> {
    const results = await this.db.insert(schema.sessions).values(session).returning();
    if (!results[0]) {
      throw new Error('Failed to create session');
    }
    return results[0];
  }

  async update(id: string, data: Partial<Omit<NewSession, 'id' | 'createdAt'>>): Promise<Session> {
    const results = await this.db
      .update(schema.sessions)
      .set(data)
      .where(eq(schema.sessions.id, id))
      .returning();
    if (!results[0]) {
      throw new Error(`Session with ID ${id} not found for update`);
    }
    return results[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  }

  async listByUserId(userId: string): Promise<Session[]> {
    return this.db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId));
  }
}
