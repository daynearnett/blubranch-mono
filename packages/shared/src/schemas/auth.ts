import { z } from 'zod';
import { AuthProvider, Role } from '../enums.js';

// ── Register ──────────────────────────────────────────────────
// Mockup screen 2A — first/last/email/phone/password/role
export const registerInputSchema = z.object({
  firstName: z.string().min(1, 'First name required').max(100),
  lastName: z.string().min(1, 'Last name required').max(100),
  email: z.string().email('Valid email required').max(255),
  phone: z
    .string()
    .min(7, 'Valid phone required')
    .max(20)
    .regex(/^[+\d][\d\s\-().]+$/, 'Phone must be digits/+/-/() only'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['worker', 'employer']),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

// ── Login ─────────────────────────────────────────────────────
export const loginInputSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

// ── Refresh ───────────────────────────────────────────────────
export const refreshInputSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshInputSchema>;

// ── Phone verification ────────────────────────────────────────
export const verifyPhoneSendSchema = z.object({
  phone: z.string().min(7).max(20),
});
export type VerifyPhoneSendInput = z.infer<typeof verifyPhoneSendSchema>;

export const verifyPhoneCheckSchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().regex(/^\d{4,8}$/, 'Code must be 4–8 digits'),
});
export type VerifyPhoneCheckInput = z.infer<typeof verifyPhoneCheckSchema>;

// ── Social ────────────────────────────────────────────────────
// Stub — full provider-specific flows come later
export const socialAuthInputSchema = z.object({
  provider: z.enum(['apple', 'google', 'facebook']),
  idToken: z.string().min(10),
  // From the provider's id_token claims (stubbed; real impl verifies signature)
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  providerUserId: z.string().min(1).max(255),
  role: z.enum(['worker', 'employer']),
});
export type SocialAuthInput = z.infer<typeof socialAuthInputSchema>;

// ── Auth response ─────────────────────────────────────────────
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string(),
    role: Role,
    authProvider: AuthProvider,
    profilePhotoUrl: z.string().nullable(),
    isVerified: z.boolean(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
