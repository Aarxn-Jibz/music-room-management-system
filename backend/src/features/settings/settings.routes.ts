import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { requireAuth, requireAdmin, AppEnv } from '../../middleware/auth.middleware.js';
import { updateSystemSettingsSchema } from '../../schemas.js';

const settingsRoutes = new Hono<AppEnv>();
const settingsAuthRoutes = new Hono<AppEnv>();

settingsAuthRoutes.use('*', requireAuth(), requireAdmin());

function toDTO(row: typeof schema.systemSettings.$inferSelect) {
  return {
    notification_email: row.notificationEmail ?? null,
    booking_release_day: row.bookingReleaseDay,
    booking_release_time: row.bookingReleaseTime,
    sheets_spreadsheet_id: row.sheetsSpreadsheetId ?? null,
    sheets_sheet_name: row.sheetsSheetName ?? null,
  };
}

settingsAuthRoutes.get('/system-settings', async (c) => {
  const db = getDb(c.env.DB);
  try {
    const rows = await db.select().from(schema.systemSettings).limit(1);
    if (!rows[0]) {
      return c.json({ message: 'System settings not found' }, 404);
    }
    return c.json(toDTO(rows[0]));
  } catch (err) {
    console.error('Get system settings error', err);
    return c.json({ message: 'Error fetching system settings' }, 500);
  }
});

settingsAuthRoutes.put('/system-settings', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = updateSystemSettingsSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    const rows = await db.select({ id: schema.systemSettings.id }).from(schema.systemSettings).limit(1);
    if (!rows[0]) {
      return c.json({ message: 'System settings not found' }, 404);
    }
    const data = parseResult.data;
    const set: Record<string, unknown> = {};
    if ('notification_email' in (body as object)) {
      const email = data.notification_email?.trim();
      set.notificationEmail = email ? email : null;
    }
    if ('sheets_spreadsheet_id' in (body as object)) {
      const spreadsheetId = data.sheets_spreadsheet_id?.trim();
      set.sheetsSpreadsheetId = spreadsheetId ? spreadsheetId : null;
    }
    if ('sheets_sheet_name' in (body as object)) {
      const sheetName = data.sheets_sheet_name?.trim();
      set.sheetsSheetName = sheetName ? sheetName : null;
    }
    const updated = await db
      .update(schema.systemSettings)
      .set(set)
      .where(eq(schema.systemSettings.id, rows[0].id))
      .returning();
    return c.json(toDTO(updated[0]));
  } catch (err) {
    console.error('Update system settings error', err);
    return c.json({ message: 'Error updating system settings' }, 500);
  }
});

settingsRoutes.route('', settingsAuthRoutes);

export { settingsRoutes };
