import { buildApp } from './app.js';

// Railway requires binding to all interfaces (0.0.0.0) so its proxy can
// reach the container. localhost / 127.0.0.1 = container-internal only,
// which makes /health 503 from Railway's perspective.
const host = '0.0.0.0';

// Number(process.env.PORT) || 4000 is more defensive than `?? 4000`:
// it falls back to 4000 for undefined, NaN, AND empty string (which
// `??` doesn't catch — `"" ?? 4000` is "", and Number("") is 0).
const port = Number(process.env.PORT) || 4000;

const app = await buildApp();

try {
  await app.listen({ port, host });
  app.log.info(`BluBranch API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
