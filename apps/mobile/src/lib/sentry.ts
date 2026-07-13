import * as Sentry from '@sentry/react-native';

let enabled = false;

/**
 * Initialize Sentry crash/error reporting for the mobile app. No-op unless
 * EXPO_PUBLIC_SENTRY_DSN is set at build time, so dev builds and the current
 * TestFlight build behave identically until a DSN is provided. Call once, as
 * early as possible (top of the root layout module).
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn || enabled) return;
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_ENV?.trim() || 'production',
    // Keep traces light on mobile; bump per environment if needed.
    tracesSampleRate: 0.1,
    // Don't attach PII (emails, IPs) automatically.
    sendDefaultPii: false,
  });
  enabled = true;
}

export function sentryEnabled(): boolean {
  return enabled;
}

/** Wrap the root component for native crash + React error-boundary capture. */
export const withSentry = Sentry.wrap;
