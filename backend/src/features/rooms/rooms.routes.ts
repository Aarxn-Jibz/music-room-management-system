import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { AppEnv } from '../../middleware/auth.middleware.js';

const roomRoutes = new Hono<AppEnv>();

roomRoutes.get('/rooms', async (c) => {
  const db = getDb(c.env.DB);

  try {
    const rooms = await db
      .select({
        id: schema.rooms.id,
        number: schema.rooms.number,
        name: schema.rooms.name,
        active: schema.rooms.active,
      })
      .from(schema.rooms)
      .orderBy(asc(schema.rooms.number), asc(schema.rooms.name));

    return c.json(rooms);
  } catch (err) {
    console.error('List rooms error', err);
    return c.json({ message: 'Error fetching rooms' }, 500);
  }
});

export { roomRoutes };
