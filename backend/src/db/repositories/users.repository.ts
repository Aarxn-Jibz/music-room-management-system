import { eq, or } from 'drizzle-orm';
import { DbClient, schema } from '../client.js';

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;

export interface IUsersRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsernameOrEmail(identifier: string): Promise<User | null>;
  create(user: NewUser): Promise<User>;
  update(id: string, data: Partial<Omit<NewUser, 'id' | 'createdAt'>>): Promise<User>;
  delete(id: string): Promise<void>;
  list(): Promise<User[]>;
}

export class DrizzleUsersRepository implements IUsersRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    return results[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return results[0] ?? null;
  }

  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(or(eq(schema.users.username, identifier), eq(schema.users.email, identifier)))
      .limit(1);
    return results[0] ?? null;
  }

  async create(user: NewUser): Promise<User> {
    const results = await this.db.insert(schema.users).values(user).returning();
    if (!results[0]) {
      throw new Error('Failed to create user');
    }
    return results[0];
  }

  async update(id: string, data: Partial<Omit<NewUser, 'id' | 'createdAt'>>): Promise<User> {
    const results = await this.db
      .update(schema.users)
      .set({
        ...data,
        updatedAt: Date.now(),
      })
      .where(eq(schema.users.id, id))
      .returning();
    if (!results[0]) {
      throw new Error(`User with ID ${id} not found for update`);
    }
    return results[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async list(): Promise<User[]> {
    return this.db.select().from(schema.users);
  }
}
