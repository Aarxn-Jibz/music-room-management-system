import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').unique().notNull(),
    email: text('email').notNull().default(''),
    name: text('name').notNull().default(''),
    passwordHash: text('password_hash').notNull(),
    role: text('role').$type<'USER' | 'ADMIN'>().notNull(),
    mustChangePassword: integer('must_change_password', { mode: 'boolean' }).default(true).notNull(),
    active: integer('active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
  }),
);

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  color: text('color').default('#4F46E5').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const userProfiles = sqliteTable(
  'user_profiles',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    profileId: text('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.profileId] }),
  }),
);

export const bookingPolicies = sqliteTable('booking_policies', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  bookingHorizonDays: integer('booking_horizon_days').notNull(),
  minBookingDurationMinutes: integer('min_booking_duration_minutes').notNull(),
  maxBookingDurationMinutes: integer('max_booking_duration_minutes').notNull(),
  bookingIntervalMinutes: integer('booking_interval_minutes').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
});

export const operatingSchedules = sqliteTable('operating_schedules', {
  id: text('id').primaryKey(),
  policyId: text('policy_id')
    .references(() => bookingPolicies.id, { onDelete: 'cascade' })
    .notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
});

export const systemSettings = sqliteTable('system_settings', {
  id: text('id').primaryKey(),
  bookingReleaseDay: integer('booking_release_day').notNull(),
  bookingReleaseTime: text('booking_release_time').notNull(),
  defaultPolicyId: text('default_policy_id')
    .references(() => bookingPolicies.id)
    .notNull(),
  notificationEmail: text('notification_email'),
  sheetsSpreadsheetId: text('sheets_spreadsheet_id'),
  sheetsSheetName: text('sheets_sheet_name'),
});

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    name: text('name').unique().notNull(),
    number: integer('number'),
    createdAt: integer('created_at').notNull(),
    active: integer('active', { mode: 'boolean' }).default(true).notNull(),
    policyId: text('policy_id').references(() => bookingPolicies.id),
    priorityProfileId: text('priority_profile_id').references(() => profiles.id),
  },
  (table) => ({
    numberUnique: uniqueIndex('rooms_number_unique').on(table.number),
  }),
);

export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    profileId: text('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    startTime: integer('start_time').notNull(),
    endTime: integer('end_time').notNull(),
    status: text('status')
      .$type<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>()
      .default('PENDING')
      .notNull(),
    reason: text('reason'),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: integer('approved_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    roomTimeIdx: index('bookings_room_time_idx').on(table.roomId, table.startTime, table.endTime),
    profileIdx: index('bookings_profile_idx').on(table.profileId),
    roomStartUnique: uniqueIndex('bookings_room_start_unique').on(table.roomId, table.startTime),
  }),
);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: integer('created_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  revoked: integer('revoked', { mode: 'boolean' }).default(false).notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  metadata: text('metadata').notNull(), // JSON serialized
  createdAt: integer('created_at').notNull(),
});
