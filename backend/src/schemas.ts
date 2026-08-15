import { z } from 'zod';

export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const loginSchema = z
  .object({
    username: z.string().min(3).max(30).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6),
  })
  .refine((data) => data.username !== undefined || data.email !== undefined, {
    message: 'Either username or email is required',
  });

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const DEFAULT_USER_PASSWORD = 'changeit';

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  bandIds: z.array(z.string()).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['user', 'admin']).optional(),
  bandIds: z.array(z.string()).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createBandSchema = z.object({
  name: z.string().min(1).max(100),
  colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color code (e.g. #4F46E5)')
    .optional(),
});

export type CreateBandInput = z.infer<typeof createBandSchema>;

export const updateBandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color code (e.g. #4F46E5)')
    .optional(),
});

export type UpdateBandInput = z.infer<typeof updateBandSchema>;

export const slotConfigCreateSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'start_time must be HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'end_time must be HH:MM'),
  enabled: z.boolean().optional(),
});

export type SlotConfigCreateInput = z.infer<typeof slotConfigCreateSchema>;

export const slotConfigUpdateSchema = z.object({
  id: z.string(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'start_time must be HH:MM').optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'end_time must be HH:MM').optional(),
  enabled: z.boolean().optional(),
});

export type SlotConfigUpdateInput = z.infer<typeof slotConfigUpdateSchema>;

export const createRequestSchema = z.object({
  user_id: z.string().min(1),
  band_id: z.string().min(1),
  room_id: z.string().min(1),
  slot_start: z.string().min(1),
  slot_end: z.string().min(1),
  reason: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const updateRequestSchema = z.object({
  status: z.enum(['approved', 'denied', 'pending']).optional(),
  reason: z.string().optional(),
  user_id: z.string().min(1).optional(),
  band_id: z.string().min(1).optional(),
  room_id: z.string().min(1).optional(),
  slot_start: z.string().min(1).optional(),
  slot_end: z.string().min(1).optional(),
  slot_id: z.string().nullable().optional(),
  request_date: z.string().optional(),
  response_date: z.string().nullable().optional(),
});

export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

export const updateSystemSettingsSchema = z.object({
  notification_email: z
    .union([z.string().email('Must be a valid email address'), z.literal('')])
    .optional(),
  sheets_spreadsheet_id: z.string().max(200, 'Must be at most 200 characters').optional(),
  sheets_sheet_name: z.string().max(80, 'Must be at most 80 characters').optional(),
});

export type UpdateSystemSettingsInput = z.infer<typeof updateSystemSettingsSchema>;
