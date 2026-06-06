import { buildApp } from './app.js';
import { setupSocketIO, closeSocketIO } from './lib/socket.js';
import { closeRedis } from './lib/redis.js';

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

  // Attach Socket.io to Fastify's underlying HTTP server. Must be done
  // AFTER listen() so the server exists. Socket.io intercepts WebSocket
  // upgrade requests before Fastify; regular HTTP requests pass through
  // to Fastify as usual.
  setupSocketIO(app.server);
  app.log.info('[Socket.io] attached to HTTP server');

  // Graceful shutdown — close Socket.io and Redis on SIGTERM/SIGINT.
  app.addHook('onClose', async () => {
    await closeSocketIO();
    await closeRedis();
  });

  app.log.info(`BluBranch API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
