import { Hono } from 'hono';
import { getDb } from '../../db/client.js';
import { AppEnv, requireAdmin, requireAuth } from '../../middleware/auth.middleware.js';
import { WeeklySheetService } from '../../sheets/service.js';

const sheetsRoutes = new Hono<AppEnv>();
const sheetsAuthRoutes = new Hono<AppEnv>();

sheetsAuthRoutes.use('*', requireAuth(), requireAdmin());

// Admin-only manual trigger for the weekly Google Sheets export. Optional
// `date` (ISO) override targets an arbitrary week, which is useful as a local
// dev harness and for idempotent regeneration. No unauthenticated path exists.
sheetsAuthRoutes.post('/sheets/weekly', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { date?: string } | null;
  const parsed = body?.date ? new Date(body.date) : null;
  const nowMs = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : Date.now();

  const db = getDb(c.env.DB);
  const service = new WeeklySheetService(db, c.env);
  const result = await service.run(nowMs);
  return c.json(result);
});

sheetsRoutes.route('', sheetsAuthRoutes);

export { sheetsRoutes };
