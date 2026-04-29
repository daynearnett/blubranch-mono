import { z } from 'zod';
import {
  ApplicationStatus,
  CompanySize,
  JobStatus,
  JobType,
  PlanTier,
  WorkSetting,
} from '../enums.js';
import { userIdSchema } from './user.js';

// ── Entity shapes (DB row representations) ────────────────────
export const companySchema = z.object({
  id: z.string().uuid(),
  employerId: userIdSchema,
  name: z.string().max(200),
  industry: z.string().max(100).nullable().optional(),
  sizeRange: CompanySize,
  website: z.string().url().max(500).nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  contactEmail: z.string().email().max(255),
  logoUrl: z.string().url().max(500).nullable().optional(),
  establishedYear: z.number().int().min(1800).max(2100).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
});
export type Company = z.infer<typeof companySchema>;

export const jobSchema = z.object({
  id: z.string().uuid(),
  employerId: userIdSchema,
  companyId: z.string().uuid(),
  title: z.string().max(200),
  tradeId: z.number().int().positive(),
  experienceLevel: z.string().max(50),
  payMin: z.number().nonnegative(),
  payMax: z.number().nonnegative(),
  jobType: JobType,
  workSetting: WorkSetting,
  city: z.string().max(100),
  state: z.string().max(50),
  zipCode: z.string().max(10),
  description: z.string().max(1000),
  openingsCount: z.number().int().positive().default(1),
  status: JobStatus,
  planTier: PlanTier,
  isFeatured: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
  boostPushNotification: z.boolean().default(false),
  boostFeaturedPlacement: z.boolean().default(false),
  stripePaymentId: z.string().max(255).nullable().optional(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});
export type Job = z.infer<typeof jobSchema>;

export const jobApplicationSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  workerId: userIdSchema,
  status: ApplicationStatus,
  message: z.string().max(2000).nullable().optional(),
  appliedAt: z.coerce.date(),
});
export type JobApplication = z.infer<typeof jobApplicationSchema>;

// ── Inputs (validated by API; reused by mobile forms) ─────────

export const companyInputSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().max(100).nullable().optional(),
  sizeRange: CompanySize,
  website: z.string().url().max(500).nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  contactEmail: z.string().email().max(255),
  logoUrl: z.string().url().max(500).nullable().optional(),
  establishedYear: z.number().int().min(1800).max(2100).nullable().optional(),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

// Used by Screen 7C/7D — full job-create payload from the wizard.
export const jobInputSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1).max(200),
  tradeId: z.number().int().positive(),
  experienceLevel: z.string().min(1).max(50),
  payMin: z.number().nonnegative().max(999999),
  payMax: z.number().nonnegative().max(999999),
  jobType: JobType,
  workSetting: WorkSetting,
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zipCode: z.string().min(1).max(10),
  description: z.string().min(1).max(1000),
  openingsCount: z.number().int().positive().max(99).default(1),
  planTier: PlanTier,
  isUrgent: z.boolean().default(false),
  boostPushNotification: z.boolean().default(false),
  boostFeaturedPlacement: z.boolean().default(false),
  benefitIds: z.array(z.number().int().positive()).max(20).default([]),
  // Sent as draft → server flips to 'open' once payment lands. For Phase 3
  // we accept either value and treat 'open' as immediate publish.
  status: JobStatus.optional(),
});
export type JobInput = z.infer<typeof jobInputSchema>;

export const jobUpdateSchema = jobInputSchema.partial();
export type JobUpdate = z.infer<typeof jobUpdateSchema>;

// Search query — used by GET /jobs.
export const jobSearchQuerySchema = z.object({
  trade: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(500).default(25),
  type: JobType.optional(),
  setting: WorkSetting.optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(['nearest', 'newest', 'pay_highest']).default('nearest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type JobSearchQuery = z.infer<typeof jobSearchQuerySchema>;

// Worker → Quick Apply.
export const jobApplyInputSchema = z.object({
  message: z.string().max(2000).optional(),
});
export type JobApplyInput = z.infer<typeof jobApplyInputSchema>;

// Employer → status update.
export const applicationStatusUpdateSchema = z.object({
  status: ApplicationStatus,
});
export type ApplicationStatusUpdate = z.infer<typeof applicationStatusUpdateSchema>;
