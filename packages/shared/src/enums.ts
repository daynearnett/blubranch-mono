import { z } from 'zod';

export const Role = z.enum(['worker', 'employer', 'admin']);
export type Role = z.infer<typeof Role>;

export const AuthProvider = z.enum(['email', 'apple', 'google', 'facebook']);
export type AuthProvider = z.infer<typeof AuthProvider>;

export const ExperienceLevel = z.enum([
  'years_0_2',
  'years_3_5',
  'years_6_10',
  'years_11_15',
  'years_16_20',
  'years_20_plus',
]);
export type ExperienceLevel = z.infer<typeof ExperienceLevel>;

export const JobAvailability = z.enum(['open', 'actively_looking', 'not_looking']);
export type JobAvailability = z.infer<typeof JobAvailability>;

export const JobType = z.enum(['full_time', 'part_time', 'contract', 'temp_to_hire']);
export type JobType = z.infer<typeof JobType>;

export const WorkSetting = z.enum(['commercial', 'residential', 'industrial', 'mixed']);
export type WorkSetting = z.infer<typeof WorkSetting>;

export const JobStatus = z.enum(['draft', 'open', 'closed', 'expired']);
export type JobStatus = z.infer<typeof JobStatus>;

export const PlanTier = z.enum(['basic', 'pro', 'unlimited']);
export type PlanTier = z.infer<typeof PlanTier>;

export const ApplicationStatus = z.enum([
  'applied',
  'reviewed',
  'shortlisted',
  'hired',
  'rejected',
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const ConnectionStatus = z.enum(['pending', 'accepted', 'declined']);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

export const CompanySize = z.enum([
  'size_1_10',
  'size_11_50',
  'size_51_200',
  'size_201_500',
  'size_500_plus',
]);
export type CompanySize = z.infer<typeof CompanySize>;
