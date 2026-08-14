import { eq, desc } from 'drizzle-orm';
import { DbClient, schema } from '../client.js';

export type AuditLog = typeof schema.auditLogs.$inferSelect;
export type NewAuditLog = typeof schema.auditLogs.$inferInsert;

export interface IAuditLogsRepository {
  findById(id: string): Promise<AuditLog | null>;
  create(log: NewAuditLog): Promise<AuditLog>;
  list(limit?: number): Promise<AuditLog[]>;
  listByActor(actorId: string): Promise<AuditLog[]>;
}

export class DrizzleAuditLogsRepository implements IAuditLogsRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<AuditLog | null> {
    const results = await this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async create(log: NewAuditLog): Promise<AuditLog> {
    const results = await this.db.insert(schema.auditLogs).values(log).returning();
    if (!results[0]) {
      throw new Error('Failed to create audit log');
    }
    return results[0];
  }

  async list(limit?: number): Promise<AuditLog[]> {
    const query = this.db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt));
    if (limit !== undefined) {
      query.limit(limit);
    }
    return query;
  }

  async listByActor(actorId: string): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.actorId, actorId))
      .orderBy(desc(schema.auditLogs.createdAt));
  }
}
