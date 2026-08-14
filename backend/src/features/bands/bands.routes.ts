import { Hono } from 'hono';
import { getDb } from '../../db/client.js';
import { BandsService } from './bands.service.js';
import { createBandSchema, updateBandSchema } from '../../schemas.js';
import {
  requireAuth,
  requirePasswordChanged,
  requireAdmin,
  AppEnv,
} from '../../middleware/auth.middleware.js';

const bandRoutes = new Hono<AppEnv>();

bandRoutes.get('/bands', async (c) => {
  const db = getDb(c.env.DB);
  const service = new BandsService(db);

  try {
    const bands = await service.list();
    return c.json(bands);
  } catch (err) {
    console.error('List bands error', err);
    return c.json({ message: 'Error fetching bands' }, 500);
  }
});

const bandAdminRoutes = new Hono<AppEnv>();
bandAdminRoutes.use('*', requireAuth(), requirePasswordChanged(), requireAdmin());

bandAdminRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = createBandSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new BandsService(db);

  try {
    const band = await service.create(parseResult.data);
    return c.json(band, 201);
  } catch (err) {
    console.error('Create band error', err);
    return c.json({ message: 'Error creating band' }, 500);
  }
});

bandAdminRoutes.put('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ message: 'Missing band id' }, 400);
  }

  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = updateBandSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new BandsService(db);

  try {
    const band = await service.update(id, parseResult.data);
    return c.json(band);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'Band not found' }, 404);
    }
    console.error('Update band error', err);
    return c.json({ message: 'Error updating band' }, 500);
  }
});

bandAdminRoutes.delete('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ message: 'Missing band id' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new BandsService(db);

  try {
    await service.delete(id);
    return c.json({ message: 'Band deleted' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'Band not found' }, 404);
    }
    console.error('Delete band error', err);
    return c.json({ message: 'Error deleting band' }, 500);
  }
});

bandRoutes.route('/bands', bandAdminRoutes);

export { bandRoutes };
