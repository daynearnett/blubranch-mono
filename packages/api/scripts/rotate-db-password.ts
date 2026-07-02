/**
 * Rotate the Postgres role password. Run INSIDE the Railway container (the DB is
 * internal-only) via:
 *   railway ssh --service blubranch \
 *     "cd /app/packages/api && NEW_DB_PASSWORD=<hex> node_modules/.bin/tsx scripts/rotate-db-password.ts"
 *
 * Connects with the CURRENT DATABASE_URL (still valid at call time) and ALTERs
 * the role password. After this succeeds, update the API's DATABASE_URL literal
 * and the Postgres service vars to the new password so the API reconnects.
 *
 * Guard: NEW_DB_PASSWORD must be lowercase hex (matches `openssl rand -hex`), so
 * inlining it into ALTER USER can't inject SQL.
 */
import { getPrisma } from '../src/lib/prisma.js';

async function main() {
  const pw = process.env.NEW_DB_PASSWORD ?? '';
  if (!/^[0-9a-f]{32,}$/.test(pw)) {
    console.error('NEW_DB_PASSWORD must be lowercase hex, >= 32 chars (use `openssl rand -hex 24`).');
    process.exit(1);
  }
  // Role name is taken from the DATABASE_URL username (default "postgres").
  const role = process.env.DB_ROLE ?? 'postgres';
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) {
    console.error('Unexpected DB_ROLE.');
    process.exit(1);
  }

  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`ALTER USER ${role} WITH PASSWORD '${pw}'`);
  console.log(`ROTATED_OK role=${role} newlen=${pw.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('rotate failed:', err);
  process.exit(1);
});
