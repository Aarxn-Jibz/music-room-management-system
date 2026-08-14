import { Hono } from 'hono';
import { desc } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { writeAuditLog } from '../../audit/index.js';
import { requireAuth, requireAdmin, AppEnv } from '../../middleware/auth.middleware.js';

export interface EntryLogDTO {
  id: string;
  equipment_id?: string | null;
  scanned_at: string;
  Equipment?: { equipment_name: string; category: string } | null;
  student_name?: string | null;
}

interface EntryLogMetadata {
  studentName?: string;
  student_name?: string;
}

function toEntryLogDTO(log: typeof schema.auditLogs.$inferSelect): EntryLogDTO {
  let metadata: EntryLogMetadata = {};
  try {
    metadata = JSON.parse(log.metadata ?? '{}') as EntryLogMetadata;
  } catch {
    metadata = {};
  }

  const studentName = metadata.studentName ?? metadata.student_name;
  const isEquipment = log.targetType === 'EQUIPMENT' || log.action === 'SCAN_EQUIPMENT';

  return {
    id: log.id,
    equipment_id: isEquipment ? log.targetId : null,
    scanned_at: new Date(log.createdAt).toISOString(),
    Equipment: null,
    student_name: log.targetType === 'STUDENT' ? (log.targetId ?? studentName ?? null) : (studentName ?? null),
  };
}

const entryLogRoutes = new Hono<AppEnv>();
const entryLogAdminRoutes = new Hono<AppEnv>();
entryLogAdminRoutes.use('*', requireAuth(), requireAdmin());

entryLogAdminRoutes.get('/entrylogs', async (c) => {
  const db = getDb(c.env.DB);

  try {
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(200);
    return c.json(logs.map(toEntryLogDTO));
  } catch (err) {
    console.error('List entry logs error', err);
    return c.json({ message: 'Error fetching entry logs' }, 500);
  }
});

entryLogAdminRoutes.post('/entrylogs', async (c) => {
  const db = getDb(c.env.DB);

  try {
    // Records a door/entry scan event in the audit log. Email scanning is
    // handled by the notification service (mocked in this environment).
    await writeAuditLog(db, null, 'ENTRY_SCAN', 'ENTRY', null, {});
    return c.json({ message: 'Scan completed successfully' });
  } catch (err) {
    console.error('Create entry log error', err);
    return c.json({ message: 'Error recording entry log' }, 500);
  }
});

entryLogRoutes.route('/entrylogs', entryLogAdminRoutes);

export { entryLogRoutes };
