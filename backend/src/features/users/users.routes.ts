import { Hono } from 'hono';
import { getDb } from '../../db/client.js';
import { UsersService } from './users.service.js';
import { updateUserSchema } from '../../schemas.js';
import {
  requireAuth,
  requirePasswordChanged,
  requireAdmin,
  AppEnv,
} from '../../middleware/auth.middleware.js';

const userRoutes = new Hono<AppEnv>();

const userAdminRoutes = new Hono<AppEnv>();
userAdminRoutes.use('*', requireAuth(), requirePasswordChanged(), requireAdmin());

userAdminRoutes.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const service = new UsersService(db);

  try {
    const users = await service.list();
    return c.json(users);
  } catch (err) {
    console.error('List users error', err);
    return c.json({ message: 'Error fetching users' }, 500);
  }
});

userAdminRoutes.put('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ message: 'Missing user id' }, 400);
  }

  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = updateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new UsersService(db);

  try {
    const result = await service.update(id, parseResult.data);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'User not found' }, 404);
    }
    console.error('Update user error', err);
    return c.json({ message: 'Error updating user' }, 500);
  }
});

userAdminRoutes.delete('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ message: 'Missing user id' }, 400);
  }

  const db = getDb(c.env.DB);
  const service = new UsersService(db);

  try {
    const result = await service.delete(id);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return c.json({ message: 'User not found' }, 404);
    }
    console.error('Delete user error', err);
    return c.json({ message: 'Error deleting user' }, 500);
  }
});

userRoutes.route('/users', userAdminRoutes);

export { userRoutes };
