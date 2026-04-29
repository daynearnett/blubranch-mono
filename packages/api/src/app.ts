import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { extractUser } from './auth/middleware.js';
import { startExpireCron } from './jobs/expire-cron.js';
import { applicationRoutes } from './routes/applications.js';
import { authRoutes } from './routes/auth.js';
import { companyRoutes } from './routes/companies.js';
import { jobRoutes } from './routes/jobs.js';
import { postRoutes } from './routes/posts.js';
import { uploadRoutes } from './routes/upload.js';
import { userRoutes } from './routes/users.js';

// Origins that may call this API. Native iOS / Android apps don't send the
// Origin header so we let those through unconditionally (the `if (!origin)`
// branch). Browsers must come from one of these domains.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/.*\.blubranch\.com$/,
  /^https?:\/\/blubranch\.com$/,
];

// CSV in EXTRA_ALLOWED_ORIGINS lets ops add origins without a deploy
// (e.g. a Vercel preview URL during admin-panel development).
function loadExtraOrigins(): string[] {
  const raw = process.env.EXTRA_ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return true;
  return loadExtraOrigins().includes(origin);
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  await app.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      // Native mobile fetch never sends Origin → always allow.
      if (!origin) return cb(null, true);
      if (isOriginAllowed(origin)) return cb(null, true);
      cb(null, false);
    },
  });
  await app.register(sensible);
  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });

  // Run extractUser on every request — populates request.user when a valid
  // bearer token is present, no-op otherwise.
  app.addHook('preHandler', extractUser);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(companyRoutes);
  await app.register(jobRoutes);
  await app.register(applicationRoutes);
  await app.register(postRoutes);
  await app.register(uploadRoutes);

  // Hourly tick to flip expired jobs. Stop on graceful shutdown so tests
  // don't keep an interval alive.
  if (process.env.NODE_ENV !== 'test') {
    const stopCron = startExpireCron(app);
    app.addHook('onClose', async () => stopCron());
  }

  return app;
}
