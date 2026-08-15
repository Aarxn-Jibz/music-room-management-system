import { schema } from '../client.js';

export type BookingStatus = typeof schema.bookings.$inferSelect['status'];

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'APPROVED'];
