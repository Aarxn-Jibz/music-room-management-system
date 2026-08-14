import { Hono } from 'hono';
import { AppEnv } from './middleware/auth.middleware.js';
import { rateLimit } from './middleware/rateLimit.middleware.js';
import { authRoutes } from './features/auth/auth.routes.js';
import { userRoutes } from './features/users/users.routes.js';
import { bandRoutes } from './features/bands/bands.routes.js';
import { roomRoutes } from './features/rooms/rooms.routes.js';
import { slotConfigRoutes } from './features/slotconfig/slotconfig.routes.js';
import { slotRoutes } from './features/slots/slots.routes.js';
import { requestRoutes } from './features/requests/requests.routes.js';
import { entryLogRoutes } from './features/entrylogs/entrylogs.routes.js';
import { settingsRoutes } from './features/settings/settings.routes.js';
import { sheetsRoutes } from './features/sheets/sheets.routes.js';
import { getDb } from './db/client.js';
import { WeeklySheetService } from './sheets/service.js';

const app = new Hono<AppEnv>();

// Apply rate limiting middleware placeholder globally
app.use('*', rateLimit());

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Mount features
app.route('/api/auth', authRoutes);
app.route('/api', userRoutes);
app.route('/api', bandRoutes);
app.route('/api', roomRoutes);
app.route('/api', slotConfigRoutes);
app.route('/api', slotRoutes);
app.route('/api', requestRoutes);
app.route('/api', entryLogRoutes);
app.route('/api', settingsRoutes);
app.route('/api', sheetsRoutes);

// Cloudflare ScheduledEvent: weekly Google Sheets export.
// Cron "30 15 * * 0" = Sunday 15:30 UTC = Sunday 21:00 IST (UTC+5:30).
export async function scheduled(
  _event: ScheduledEvent,
  env: AppEnv['Bindings'],
  _ctx: ExecutionContext,
): Promise<void> {
  const db = getDb(env.DB);
  const service = new WeeklySheetService(db, env);
  const result = await service.run();
  console.log(`[weekly-sheet] scheduled ${result.status}`, result);
}

export default {
  fetch: app.fetch,
  scheduled,
} as const;
export type { AppEnv };
