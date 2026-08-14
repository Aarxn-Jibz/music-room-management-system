import { auditLogs } from '../db/schema.js';

export interface AuditLogDb {
  insert: (table: typeof auditLogs) => {
    values: (values: typeof auditLogs.$inferInsert) => Promise<unknown>;
  };
}

export async function writeAuditLog(
  db: AuditLogDb,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId,
    action,
    targetType,
    targetId,
    metadata: JSON.stringify(metadata),
    createdAt: Date.now(),
  });
}
