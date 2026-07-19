import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(['ios', 'android', 'web']),
});
export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

export const notificationPreferencesSchema = z.object({
  notifyMessages: z.boolean().optional(),
  notifyConnectionRequests: z.boolean().optional(),
  notifyApplicationStatus: z.boolean().optional(),
  notifyJobMatch: z.boolean().optional(),
  notifyProfileViews: z.boolean().optional(),
  notifyProfileNudges: z.boolean().optional(),
  notifyPostLikes: z.boolean().optional(),
  notifyPostComments: z.boolean().optional(),
  notifyMentions: z.boolean().optional(),
  notifyLicenseExpiry: z.boolean().optional(),
  notifyVouches: z.boolean().optional(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
