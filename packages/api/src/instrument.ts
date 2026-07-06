// Side-effect module: initializes Sentry BEFORE any other app module loads so it
// can auto-instrument HTTP, the database driver, etc. Must be the very first
// import in server.ts. No-op unless SENTRY_DSN is set.
import { initSentry } from './lib/sentry.js';

initSentry();
