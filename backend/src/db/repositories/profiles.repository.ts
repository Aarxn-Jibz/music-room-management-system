import { eq, and } from 'drizzle-orm';
import { DbClient, schema } from '../client.js';
import { User } from './users.repository.js';

export type Profile = typeof schema.profiles.$inferSelect;
export type NewProfile = typeof schema.profiles.$inferInsert;

export interface IProfilesRepository {
  findById(id: string): Promise<Profile | null>;
  findByName(name: string): Promise<Profile | null>;
  create(profile: NewProfile): Promise<Profile>;
  update(id: string, name: string, color?: string): Promise<Profile>;
  delete(id: string): Promise<void>;
  list(): Promise<Profile[]>;
  linkUser(userId: string, profileId: string): Promise<void>;
  unlinkUser(userId: string, profileId: string): Promise<void>;
  getUsersForProfile(profileId: string): Promise<User[]>;
  getProfilesForUser(userId: string): Promise<Profile[]>;
}

export class DrizzleProfilesRepository implements IProfilesRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Profile | null> {
    const results = await this.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async findByName(name: string): Promise<Profile | null> {
    const results = await this.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.name, name))
      .limit(1);
    return results[0] ?? null;
  }

  async create(profile: NewProfile): Promise<Profile> {
    const results = await this.db.insert(schema.profiles).values(profile).returning();
    if (!results[0]) {
      throw new Error('Failed to create profile');
    }
    return results[0];
  }

  async update(id: string, name: string, color?: string): Promise<Profile> {
    const results = await this.db
      .update(schema.profiles)
      .set({ name, ...(color ? { color } : {}) })
      .where(eq(schema.profiles.id, id))
      .returning();
    if (!results[0]) {
      throw new Error(`Profile with ID ${id} not found for update`);
    }
    return results[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.profiles).where(eq(schema.profiles.id, id));
  }

  async list(): Promise<Profile[]> {
    return this.db.select().from(schema.profiles);
  }

  async linkUser(userId: string, profileId: string): Promise<void> {
    await this.db.insert(schema.userProfiles).values({ userId, profileId }).onConflictDoNothing();
  }

  async unlinkUser(userId: string, profileId: string): Promise<void> {
    await this.db
      .delete(schema.userProfiles)
      .where(
        and(eq(schema.userProfiles.userId, userId), eq(schema.userProfiles.profileId, profileId)),
      );
  }

  async getUsersForProfile(profileId: string): Promise<User[]> {
    const results = await this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        name: schema.users.name,
        passwordHash: schema.users.passwordHash,
        role: schema.users.role,
        mustChangePassword: schema.users.mustChangePassword,
        active: schema.users.active,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.userProfiles)
      .innerJoin(schema.users, eq(schema.userProfiles.userId, schema.users.id))
      .where(eq(schema.userProfiles.profileId, profileId));
    return results;
  }

  async getProfilesForUser(userId: string): Promise<Profile[]> {
    const results = await this.db
      .select({
        id: schema.profiles.id,
        name: schema.profiles.name,
        color: schema.profiles.color,
        createdAt: schema.profiles.createdAt,
      })
      .from(schema.userProfiles)
      .innerJoin(schema.profiles, eq(schema.userProfiles.profileId, schema.profiles.id))
      .where(eq(schema.userProfiles.userId, userId));
    return results;
  }
}
