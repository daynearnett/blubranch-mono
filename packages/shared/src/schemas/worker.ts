import { z } from 'zod';
import { ExperienceLevel, JobAvailability } from '../enums.js';
import { userIdSchema } from './user.js';

export const workerProfileSchema = z.object({
  id: z.string().uuid(),
  userId: userIdSchema,
  headline: z.string().max(200).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  experienceLevel: ExperienceLevel,
  hourlyRate: z.number().positive().nullable().optional(),
  city: z.string().max(100),
  state: z.string().max(50),
  zipCode: z.string().max(10),
  travelRadiusMiles: z.number().int().positive().max(500),
  jobAvailability: JobAvailability,
  unionName: z.string().max(200).nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WorkerProfile = z.infer<typeof workerProfileSchema>;

export const certificationSchema = z.object({
  id: z.string().uuid(),
  userId: userIdSchema,
  name: z.string().max(200),
  certificationNumber: z.string().max(100).nullable().optional(),
  isVerified: z.boolean(),
  verifiedAt: z.coerce.date().nullable().optional(),
});
export type Certification = z.infer<typeof certificationSchema>;

export const portfolioPhotoSchema = z.object({
  id: z.string().uuid(),
  userId: userIdSchema,
  photoUrl: z.string().url().max(500),
  caption: z.string().max(100).nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
});
export type PortfolioPhoto = z.infer<typeof portfolioPhotoSchema>;

export const workHistorySchema = z
  .object({
    id: z.string().uuid(),
    userId: userIdSchema,
    companyName: z.string().max(200),
    title: z.string().max(200),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    isCurrent: z.boolean(),
  })
  .refine((v) => v.isCurrent || !!v.endDate, {
    path: ['endDate'],
    message: 'endDate required when not current',
  });
export type WorkHistory = z.infer<typeof workHistorySchema>;
