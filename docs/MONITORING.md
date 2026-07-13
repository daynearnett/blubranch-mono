# Monitoring — Sentry + uptime

Error monitoring is wired for both the API and the mobile app, and is **inert
until you provide a DSN** — nothing is sent in dev/CI/TestFlight until then, so
this can ship without any account setup and be activated later by adding env vars.

## API (Sentry — `@sentry/node`)

- Init: `packages/api/src/instrument.ts` (imported first in `server.ts`, before any
  other module, so HTTP/DB auto-instrumentation hooks). Logic in
  `packages/api/src/lib/sentry.ts`. Fastify 500s are captured via
  `Sentry.setupFastifyErrorHandler`; startup failures via a manual `captureError`.
- **Activate:** create a project at sentry.io (platform: Node/Fastify), then set on
  the Railway `blubranch` service:
  - `SENTRY_DSN=<node dsn>`
  - optional: `SENTRY_TRACES_SAMPLE_RATE` (default `0.1`), `SENTRY_RELEASE`
    (defaults to `RAILWAY_GIT_COMMIT_SHA`).
- Without `SENTRY_DSN`, `initSentry()` returns false and every Sentry call is a
  no-op. Verified locally: boots + tests pass with no DSN; initializes cleanly with one.

## Mobile (Sentry — `@sentry/react-native`)

- Init: `apps/mobile/src/lib/sentry.ts`, called at the top of `app/_layout.tsx`;
  the root component is wrapped with `Sentry.wrap` for native-crash +
  React-error-boundary capture. The `@sentry/react-native` Expo config plugin is
  in `app.json`.
- **Activate:**
  - Set `EXPO_PUBLIC_SENTRY_DSN=<react-native dsn>` at build time (add to the
    relevant profile's `env` in `eas.json`, or a local `.env`). `EXPO_PUBLIC_*`
    vars are inlined into the JS bundle at build.
  - Optional `EXPO_PUBLIC_ENV` sets the Sentry environment (default `production`).
  - For readable stack traces, source-map upload needs `SENTRY_ORG`,
    `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` present in the EAS build environment
    (the plugin skips upload silently when the auth token is absent — builds don't
    break without it).
- Requires a native rebuild (already the case — not Expo Go). Without a DSN,
  `initSentry()` is a no-op.

## Uptime

- **Container-level (already configured):** `railway.toml` sets
  `healthcheckPath = "/health"` — Railway restarts the container if `/health`
  stops responding.
- **External uptime (recommended, do at go-live):** point a free external monitor
  at the public health endpoint so you're alerted if the whole service is down
  (Railway's own check can't tell you that):
  - URL: `https://api-staging.blubranch.com/health` (and `https://api.blubranch.com/health` once prod DNS is live).
  - Provider suggestion: **Better Stack (Better Uptime)** or **UptimeRobot** — 1–3 min
    interval, alert to email/Slack. Both have free tiers sufficient for one endpoint.
