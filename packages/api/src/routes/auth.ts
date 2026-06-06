import {
  checkEmailSchema,
  loginInputSchema,
  refreshInputSchema,
  registerInputSchema,
  sendVerificationEmailSchema,
  socialAuthInputSchema,
  verifyEmailCodeSchema,
  verifyPhoneCheckSchema,
  verifyPhoneSendSchema,
} from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@blubranch/db';
import { signTokenPair, verifyRefreshToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { checkVerificationCode, sendVerificationCode } from '../auth/twilio.js';
import {
  generateVerificationCode as generateEmailCode,
  checkVerificationCode as checkEmailVerificationCode,
  sendVerificationEmail,
} from '../services/email.js';
import { getPrisma } from '../lib/prisma.js';
import { serializeUser } from '../lib/serialize.js';
import { parseBody } from '../lib/validate.js';

const TERMS_VERSION = '1.0';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── POST /auth/register ─────────────────────────────────────────
  app.post('/auth/register', async (request, reply) => {
    const data = parseBody(registerInputSchema, request, reply);
    if (!data) return;

    const passwordHash = await hashPassword(data.password);

    try {
      const user = await prisma.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email.toLowerCase(),
          phone: data.phone ?? null,
          passwordHash,
          role: data.role,
          authProvider: 'email',
          ...(data.termsAccepted
            ? { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION }
            : {}),
          ...(data.role === 'worker'
            ? {
                workerProfile: {
                  create: {
                    experienceLevel: 'years_0_2',
                    city: '',
                    state: '',
                    zipCode: '',
                    travelRadiusMiles: 25,
                    jobAvailability: 'open',
                  },
                },
                settings: { create: {} },
              }
            : {}),
        },
      });

      const tokens = signTokenPair(user.id, user.role);
      return reply.code(201).send({ ...tokens, user: serializeUser(user) });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return reply.code(409).send({ error: 'Conflict', message: `${target} already in use` });
      }
      throw err;
    }
  });

  // ── POST /auth/login ────────────────────────────────────────────
  app.post('/auth/login', async (request, reply) => {
    const data = parseBody(loginInputSchema, request, reply);
    if (!data) return;

    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    const tokens = signTokenPair(user.id, user.role);
    return reply.send({ ...tokens, user: serializeUser(user) });
  });

  // ── POST /auth/refresh ──────────────────────────────────────────
  app.post('/auth/refresh', async (request, reply) => {
    const data = parseBody(refreshInputSchema, request, reply);
    if (!data) return;

    let userId: string;
    try {
      userId = verifyRefreshToken(data.refreshToken).sub;
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'User no longer exists' });
    }
    const tokens = signTokenPair(user.id, user.role);
    return reply.send({ ...tokens, user: serializeUser(user) });
  });

  // ── POST /auth/verify-phone/send ────────────────────────────────
  app.post('/auth/verify-phone/send', async (request, reply) => {
    const data = parseBody(verifyPhoneSendSchema, request, reply);
    if (!data) return;
    const { devCode } = await sendVerificationCode(data.phone);
    return reply.send({ sent: true, devCode });
  });

  // ── POST /auth/verify-phone (check) ─────────────────────────────
  app.post('/auth/verify-phone', async (request, reply) => {
    const data = parseBody(verifyPhoneCheckSchema, request, reply);
    if (!data) return;
    const ok = await checkVerificationCode(data.phone, data.code);
    if (!ok) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Invalid or expired code' });
    }
    // Mark any user with this phone as verified.
    await prisma.user.updateMany({
      where: { phone: data.phone },
      data: { isVerified: true, phoneVerified: true },
    });
    return reply.send({ verified: true });
  });

  // ── POST /auth/check-email ───────────────────────────────────────
  app.post('/auth/check-email', async (request, reply) => {
    const data = parseBody(checkEmailSchema, request, reply);
    if (!data) return;
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });
    return reply.send({ available: !existing });
  });

  // ── POST /auth/send-verification-email ──────────────────────────
  app.post('/auth/send-verification-email', async (request, reply) => {
    const data = parseBody(sendVerificationEmailSchema, request, reply);
    if (!data) return;
    const code = generateEmailCode(data.email);
    await sendVerificationEmail(data.email, code);
    const isDev = !process.env.RESEND_API_KEY;
    return reply.send({ sent: true, ...(isDev ? { devCode: code } : {}) });
  });

  // ── POST /auth/verify-email-code ────────────────────────────────
  app.post('/auth/verify-email-code', async (request, reply) => {
    const data = parseBody(verifyEmailCodeSchema, request, reply);
    if (!data) return;
    const ok = checkEmailVerificationCode(data.email, data.code);
    if (!ok) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Invalid or expired code' });
    }
    await prisma.user.updateMany({
      where: { email: data.email.toLowerCase() },
      data: { emailVerified: true },
    });
    return reply.send({ verified: true });
  });

  // ── POST /auth/social (stub) ────────────────────────────────────
  // Real implementation: verify provider id_token signature against issuer.
  // For Phase 1 we accept the trusted-payload form so the flow is wired end to end.
  app.post('/auth/social', async (request, reply) => {
    const data = parseBody(socialAuthInputSchema, request, reply);
    if (!data) return;

    let user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email.toLowerCase(),
          phone: `social-${data.provider}-${data.providerUserId}`.slice(0, 20),
          role: data.role,
          authProvider: data.provider,
          authProviderId: data.providerUserId,
          ...(data.role === 'worker'
            ? {
                workerProfile: {
                  create: {
                    experienceLevel: 'years_0_2',
                    city: '',
                    state: '',
                    zipCode: '',
                    travelRadiusMiles: 25,
                    jobAvailability: 'open',
                  },
                },
                settings: { create: {} },
              }
            : {}),
        },
      });
    }

    const tokens = signTokenPair(user.id, user.role);
    return reply.send({ ...tokens, user: serializeUser(user) });
  });
}
