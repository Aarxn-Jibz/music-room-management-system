import { eq, inArray } from 'drizzle-orm';
import { DbClient, schema } from '../../db/client.js';
import { UpdateUserInput } from '../../schemas.js';
import { mapRoleFromApi, toUserDTO, UserDTO } from '../../dto.js';

export class UsersService {
  constructor(private db: DbClient) {}

  async list(): Promise<UserDTO[]> {
    const users = await this.db
      .select()
      .from(schema.users)
      .orderBy(schema.users.createdAt);

    if (users.length === 0) {
      return [];
    }

    const userIds = users.map((u) => u.id);
    const links = await this.db
      .select({
        userId: schema.userProfiles.userId,
        profileId: schema.profiles.id,
        name: schema.profiles.name,
      })
      .from(schema.userProfiles)
      .innerJoin(schema.profiles, eq(schema.userProfiles.profileId, schema.profiles.id))
      .where(inArray(schema.userProfiles.userId, userIds));

    const profileMap = new Map<string, { id: string; name: string }[]>();
    for (const link of links) {
      if (!profileMap.has(link.userId)) {
        profileMap.set(link.userId, []);
      }
      profileMap.get(link.userId)!.push({ id: link.profileId, name: link.name });
    }

    return users.map((u) => toUserDTO(u, profileMap.get(u.id) ?? []));
  }

  async update(id: string, data: UpdateUserInput): Promise<{ message: string }> {
    const existing = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }

    const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: Date.now() };
    if (data.name !== undefined) {
      updates.name = data.name;
    }
    if (data.email !== undefined) {
      updates.email = data.email;
    }
    if (data.role !== undefined) {
      updates.role = mapRoleFromApi(data.role);
    }
    if (Object.keys(updates).length > 1) {
      await this.db.update(schema.users).set(updates).where(eq(schema.users.id, id));
    }

    if (data.bandIds !== undefined) {
      await this.db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, id));
      if (data.bandIds.length > 0) {
        await this.db
          .insert(schema.userProfiles)
          .values(data.bandIds.map((bandId) => ({ userId: id, profileId: bandId })))
          .onConflictDoNothing();
      }
    }

    return { message: 'User updated' };
  }

  async delete(id: string): Promise<{ message: string }> {
    const existing = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!existing[0]) {
      throw new Error('NOT_FOUND');
    }

    await this.db.update(schema.sessions).set({ revoked: true }).where(eq(schema.sessions.userId, id));
    await this.db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, id));
    await this.db.delete(schema.users).where(eq(schema.users.id, id));

    return { message: 'User deleted' };
  }
}
