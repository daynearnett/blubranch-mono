import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';

let enabled = false;

/**
 * Initialize Sentry error monitoring. No-op (returns false) unless SENTRY_DSN is
 * set, so the app runs identically in dev/test/CI without a DSN. Call this as
 * early as possible — see src/instrument.ts, imported first in server.ts — so
 * Sentry can auto-instrument HTTP/DB before those modules load.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Railway injects the commit sha; use it as the release when present.
    release:
      process.env.SENTRY_RELEASE?.trim() ||
      process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
      undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    // We handle PII deliberately; don't let Sentry attach request bodies/headers.
    sendDefaultPii: false,
  });
  enabled = true;
  return true;
}

export function sentryEnabled(): boolean {
  return enabled;
}

/** Attach Sentry's Fastify error handler (captures 500s). Safe no-op if disabled. */
export function setupFastifySentry(app: FastifyInstance): void {
  if (!enabled) return;
  Sentry.setupFastifyErrorHandler(app);
}

/** Manually report an error (e.g. from a top-level catch). No-op if disabled. */
export function captureError(err: unknown, extra?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, extra ? { extra } : undefined);
}
