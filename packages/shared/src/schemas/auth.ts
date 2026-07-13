import { z } from 'zod';
import { AuthProvider, Role } from '../enums.js';

// ── Register ──────────────────────────────────────────────────
export const registerInputSchema = z.object({
  firstName: z.string().min(1, 'First name required').max(100),
  lastName: z.string().min(1, 'Last name required').max(100),
  email: z.string().email('Valid email required').max(255),
  phone: z
    .string()
    .min(7, 'Valid phone required')
    .max(20)
    .regex(/^[+\d][\d\s\-().]+$/, 'Phone must be digits/+/-/() only')
    .optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['worker', 'employer']),
  termsAccepted: z.boolean().optional(),
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
// The server derives identity (email, provider user id, verified name) from the
// cryptographically-verified `idToken`. The client MUST NOT send email/sub —
// those are ignored. `firstName`/`lastName` are accepted only as the display-name
// fallback for Apple's first sign-in (Apple omits the name from the token).
export const socialAuthInputSchema = z.object({
  provider: z.enum(['apple', 'google']),
  idToken: z.string().min(10),
  role: z.enum(['worker', 'employer']).default('worker'),
  // Apple-first-signin display name only; never trusted for identity.
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});
export type SocialAuthInput = z.infer<typeof socialAuthInputSchema>;

// ── Email verification ────────────────────────────────────────
export const sendVerificationEmailSchema = z.object({
  email: z.string().email().max(255),
});
export type SendVerificationEmailInput = z.infer<typeof sendVerificationEmailSchema>;

export const verifyEmailCodeSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export type VerifyEmailCodeInput = z.infer<typeof verifyEmailCodeSchema>;

// ── Check email availability ──────────────────────────────────
export const checkEmailSchema = z.object({
  email: z.string().email().max(255),
});
export type CheckEmailInput = z.infer<typeof checkEmailSchema>;

// ── Auth response ─────────────────────────────────────────────
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    role: Role,
    authProvider: AuthProvider,
    profilePhotoUrl: z.string().nullable(),
    isVerified: z.boolean(),
    emailVerified: z.boolean(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
