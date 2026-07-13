import { defineConfig } from 'vitest/config';

// These are integration tests: each file builds the real Fastify app and talks
// to a single shared Postgres. Running the files in parallel makes many
// PrismaClients + bcrypt(12) hashes contend for that one DB, which shows up as
// cold-start timeouts. Serialize the files (they still run in-order internally)
// and give slow first-hit requests room. Fast, reliable pre-push gate.
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
