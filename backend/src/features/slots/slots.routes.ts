import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { SlotsService } from './slots.service.js';
import { AppEnv } from '../../middleware/auth.middleware.js';

const slotRoutes = new Hono<AppEnv>();

const slotsQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  roomNumber: z.string().optional(),
});

function parseEpoch(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const epoch = Date.parse(value);
  return Number.isNaN(epoch) ? undefined : epoch;
}

slotRoutes.get('/slots', async (c) => {
  const query = c.req.query();
  const parseResult = slotsQuerySchema.safeParse(query);
  if (!parseResult.success) {
    return c.json({ message: 'Invalid query parameters' }, 400);
  }

  const roomNumber = parseResult.data.roomNumber
    ? Number(parseResult.data.roomNumber)
    : undefined;

  const db = getDb(c.env.DB);
  const service = new SlotsService(db);

  try {
    const bookings = await service.listBookedSlots({
      start: parseEpoch(parseResult.data.start),
      end: parseEpoch(parseResult.data.end),
      roomNumber,
    });
    return c.json(bookings);
  } catch (err) {
    console.error('List slots error', err);
    return c.json({ message: 'Error fetching slots' }, 500);
  }
});

export { slotRoutes };
