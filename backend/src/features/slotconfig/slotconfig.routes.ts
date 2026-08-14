import { Hono } from 'hono';
import { getDb } from '../../db/client.js';
import { SlotConfigService } from './slotconfig.service.js';
import { slotConfigCreateSchema, slotConfigUpdateSchema } from '../../schemas.js';
import {
  requireAuth,
  requirePasswordChanged,
  requireAdmin,
  AppEnv,
} from '../../middleware/auth.middleware.js';

const slotConfigRoutes = new Hono<AppEnv>();

slotConfigRoutes.get('/slotconfig', async (c) => {
  const db = getDb(c.env.DB);
  const service = new SlotConfigService(db);

  try {
    const slots = await service.listDistinctSlots();
    return c.json(slots);
  } catch (err) {
    console.error('List slot config error', err);
    return c.json({ message: 'Error fetching slot config' }, 500);
  }
});

const slotConfigAdminRoutes = new Hono<AppEnv>();
slotConfigAdminRoutes.use('*', requireAuth(), requirePasswordChanged(), requireAdmin());

slotConfigAdminRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = slotConfigCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new SlotConfigService(db);

  try {
    const slot = await service.createSlot(parseResult.data);
    return c.json(slot, 201);
  } catch (err) {
    console.error('Create slot config error', err);
    return c.json({ message: 'Error creating slot config' }, 500);
  }
});

slotConfigAdminRoutes.put('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = slotConfigUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new SlotConfigService(db);

  try {
    const result = await service.updateSlot(parseResult.data.id, parseResult.data);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'Slot config not found' }, 404);
    }
    console.error('Update slot config error', err);
    return c.json({ message: 'Error updating slot config' }, 500);
  }
});

slotConfigAdminRoutes.delete('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ message: 'Missing slot config id' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new SlotConfigService(db);

  try {
    const result = await service.deleteSlot(id);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'Slot config not found' }, 404);
    }
    console.error('Delete slot config error', err);
    return c.json({ message: 'Error deleting slot config' }, 500);
  }
});

slotConfigRoutes.route('/slotconfig', slotConfigAdminRoutes);

export { slotConfigRoutes };
