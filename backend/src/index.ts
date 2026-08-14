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

export default app;
export type { AppEnv };
