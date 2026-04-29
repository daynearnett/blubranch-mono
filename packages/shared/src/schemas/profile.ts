import { z } from 'zod';
import { ExperienceLevel, JobAvailability } from '../enums.js';

// ── Worker profile update (3A + 2B + 2C combined) ─────────────
export const workerProfileInputSchema = z.object({
  headline: z.string().max(200).optional().nullable(),
  bio: z.string().max(300).optional().nullable(),
  experienceLevel: ExperienceLevel.optional(),
  hourlyRate: z.number().nonnegative().max(9999).optional().nullable(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(10).optional(),
  travelRadiusMiles: z.number().int().min(1).max(500).optional(),
  jobAvailability: JobAvailability.optional(),
  unionName: z.string().max(200).optional().nullable(),
  // Self-reported license #. Reserved on the worker profile so the
  // certifications table can stay focused on named, verifiable credentials.
  licenseNumber: z.string().max(100).optional().nullable(),
});
export type WorkerProfileInput = z.infer<typeof workerProfileInputSchema>;

// ── Trades (2B) ───────────────────────────────────────────────
export const setTradesInputSchema = z.object({
  tradeIds: z.array(z.number().int().positive()).min(1).max(12),
});
export type SetTradesInput = z.infer<typeof setTradesInputSchema>;

// ── Skills (3B, max 8) ────────────────────────────────────────
export const setSkillsInputSchema = z.object({
  skillIds: z.array(z.number().int().positive()).max(8),
});
export type SetSkillsInput = z.infer<typeof setSkillsInputSchema>;

// ── Certifications (3B) ───────────────────────────────────────
export const certificationInputSchema = z.object({
  name: z.string().min(1).max(200),
  certificationNumber: z.string().max(100).optional().nullable(),
});
export type CertificationInput = z.infer<typeof certificationInputSchema>;

// ── Portfolio photos (3C, max 12) ─────────────────────────────
export const portfolioPhotoInputSchema = z.object({
  photoUrl: z.string().url().max(500),
  caption: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type PortfolioPhotoInput = z.infer<typeof portfolioPhotoInputSchema>;

// ── Work history (3C) ─────────────────────────────────────────
export const workHistoryInputSchema = z
  .object({
    companyName: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    isCurrent: z.boolean(),
  })
  .refine((v) => v.isCurrent || !!v.endDate, {
    path: ['endDate'],
    message: 'endDate required when not current',
  });
export type WorkHistoryInput = z.infer<typeof workHistoryInputSchema>;

// ── Settings (3D) ─────────────────────────────────────────────
export const userSettingsInputSchema = z.object({
  openToWork: z.boolean().optional(),
  showHourlyRate: z.boolean().optional(),
  showUnion: z.boolean().optional(),
  financialTips: z.boolean().optional(),
  jobAlerts: z.boolean().optional(),
});
export type UserSettingsInput = z.infer<typeof userSettingsInputSchema>;
