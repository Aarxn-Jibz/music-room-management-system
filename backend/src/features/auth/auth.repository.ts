import { eq } from 'drizzle-orm';
import { DbClient, schema } from '../../db/client.js';
import { User, NewUser } from '../../db/repositories/users.repository.js';
import { Session, NewSession } from '../../db/repositories/sessions.repository.js';
import { Profile } from '../../db/repositories/profiles.repository.js';

export interface IAuthRepository {
  findUserByUsername(username: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(userId: string): Promise<User | null>;
  createUser(user: NewUser): Promise<User>;
  linkProfiles(userId: string, profileIds: string[]): Promise<void>;
  createSession(session: NewSession): Promise<Session>;
  getSessionById(id: string): Promise<Session | null>;
  revokeSession(id: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateLastSeen(id: string, lastSeenAt: number): Promise<void>;
  getProfilesForUser(userId: string): Promise<Profile[]>;
}

export class DrizzleAuthRepository implements IAuthRepository {
  constructor(private db: DbClient) {}

  async findUserByUsername(username: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    return results[0] ?? null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return results[0] ?? null;
  }

  async findUserById(userId: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return results[0] ?? null;
  }

  async createUser(user: NewUser): Promise<User> {
    const results = await this.db.insert(schema.users).values(user).returning();
    if (!results[0]) {
      throw new Error('Failed to create user');
    }
    return results[0];
  }

  async linkProfiles(userId: string, profileIds: string[]): Promise<void> {
    if (profileIds.length === 0) {
      return;
    }
    await this.db
      .insert(schema.userProfiles)
      .values(profileIds.map((profileId) => ({ userId, profileId })))
      .onConflictDoNothing();
  }

  async createSession(session: NewSession): Promise<Session> {
    const results = await this.db.insert(schema.sessions).values(session).returning();
    if (!results[0]) {
      throw new Error('Failed to create session');
    }
    return results[0];
  }

  async getSessionById(id: string): Promise<Session | null> {
    const results = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async revokeSession(id: string): Promise<void> {
    await this.db.update(schema.sessions).set({ revoked: true }).where(eq(schema.sessions.id, id));
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(schema.users)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: Date.now(),
      })
      .where(eq(schema.users.id, userId));
  }

  async updateLastSeen(id: string, lastSeenAt: number): Promise<void> {
    await this.db.update(schema.sessions).set({ lastSeenAt }).where(eq(schema.sessions.id, id));
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
