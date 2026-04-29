import { z } from 'zod';
import { AuthProvider, Role } from '../enums.js';

export const userIdSchema = z.string().uuid();

// Full user entity (as stored in DB / returned by API).
export const userBaseSchema = z.object({
  id: userIdSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(7).max(20),
  role: Role,
  authProvider: AuthProvider,
  authProviderId: z.string().max(255).nullable().optional(),
  profilePhotoUrl: z.string().url().max(500).nullable().optional(),
  isVerified: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userBaseSchema>;

// User settings entity (DB row).
export const userSettingsSchema = z.object({
  userId: userIdSchema,
  openToWork: z.boolean(),
  showHourlyRate: z.boolean(),
  showUnion: z.boolean(),
  financialTips: z.boolean(),
  jobAlerts: z.boolean(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

// Input schemas for register/login live in ./auth.ts.
