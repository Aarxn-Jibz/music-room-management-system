import { schema } from '../client.js';

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
