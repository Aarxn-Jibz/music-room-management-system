import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { RequestsService } from './requests.service.js';
import { createRequestSchema, updateRequestSchema } from '../../schemas.js';
import { requireAuth, AppEnv } from '../../middleware/auth.middleware.js';

const requestRoutes = new Hono<AppEnv>();
const requestAuthRoutes = new Hono<AppEnv>();

requestAuthRoutes.use('*', requireAuth());

const listQuerySchema = z.object({
  room_id: z.string().optional(),
  user_id: z.string().optional(),
});

requestAuthRoutes.get('/', async (c) => {
  const query = c.req.query();
  const parseResult = listQuerySchema.safeParse(query);
  if (!parseResult.success) {
    return c.json({ message: 'Invalid query parameters' }, 400);
  }

  const actor = c.get('user');
  if (parseResult.data.user_id && actor.role !== 'ADMIN' && parseResult.data.user_id !== actor.id) {
    return c.json({ message: 'Forbidden: You can only view your own requests' }, 403);
  }

  const db = getDb(c.env.DB);
  const service = new RequestsService(db);

  try {
    const requests = await service.list({
      roomId: parseResult.data.room_id,
      userId: parseResult.data.user_id,
    });
    return c.json(requests);
  } catch (err) {
    console.error('List requests error', err);
    return c.json({ message: 'Error fetching requests' }, 500);
  }
});

requestAuthRoutes.post('/', async (c) => {
  const actor = c.get('user');
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = createRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new RequestsService(db);

  try {
    const request = await service.create(actor, parseResult.data);
    return c.json(request, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('BAD_REQUEST:')) {
      return c.json({ message: msg.replace('BAD_REQUEST: ', '') }, 400);
    }
    if (msg.startsWith('FORBIDDEN:')) {
      return c.json({ message: msg.replace('FORBIDDEN: ', '') }, 403);
    }
    if (msg.startsWith('CONFLICT:')) {
      const bandName = msg.split(':')[1];
      return c.json(
        {
          message: `This time slot is already booked by ${bandName || 'another profile'}. Please choose a different time or room.`,
          band_name: bandName || null,
        },
        409,
      );
    }
    console.error('Create request error', err);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

requestAuthRoutes.put('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ message: 'Missing request id' }, 400);
  }

  const actor = c.get('user');
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = updateRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new RequestsService(db);

  try {
    const request = await service.update(actor, id, parseResult.data, actor.role === 'ADMIN');
    return c.json({ message: 'Request updated', request });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'Request not found' }, 404);
    }
    if (msg.startsWith('FORBIDDEN')) {
      return c.json({ message: 'Forbidden' }, 403);
    }
    if (msg.startsWith('BAD_REQUEST:')) {
      return c.json({ message: msg.replace('BAD_REQUEST: ', '') }, 400);
    }
    if (msg.startsWith('CONFLICT:')) {
      const bandName = msg.split(':')[1];
      return c.json(
        {
          message: `This time slot is already booked by ${bandName || 'another profile'}. Please choose a different time or room.`,
          band_name: bandName || null,
        },
        409,
      );
    }
    console.error('Update request error', err);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

requestAuthRoutes.delete('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ message: 'Missing request id' }, 400);
  }

  const actor = c.get('user');
  const db = getDb(c.env.DB);
  const service = new RequestsService(db);

  try {
    const result = await service.remove(actor, id);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'Request not found' }, 404);
    }
    if (msg.startsWith('FORBIDDEN')) {
      return c.json({ message: 'Forbidden' }, 403);
    }
    console.error('Delete request error', err);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

requestRoutes.route('/requests', requestAuthRoutes);

export { requestRoutes };
