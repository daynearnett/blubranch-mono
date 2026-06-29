/**
 * Create (or promote) an admin user for the BluBranch admin panel.
 *
 * Usage (from repo root, with .env loaded):
 *   ADMIN_EMAIL=admin@blubranch.com ADMIN_PASSWORD='choose-a-strong-pw' \
 *     pnpm --filter @blubranch/api exec tsx scripts/create-admin.ts
 *
 * If a user with ADMIN_EMAIL exists, it's promoted to role=admin and its
 * password is reset to ADMIN_PASSWORD. Otherwise a new admin user is created.
 * No default password is ever baked in (kept out of the seed on purpose).
 */
import { getPrisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/auth/password.js';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const prisma = getPrisma();
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'admin', passwordHash, emailVerified: true },
    });
    console.log(`✓ Promoted existing user ${email} to admin and reset password.`);
  } else {
    await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'User',
        email,
        passwordHash,
        role: 'admin',
        authProvider: 'email',
        emailVerified: true,
        termsAcceptedAt: new Date(),
        termsVersion: '1.0',
      },
    });
    console.log(`✓ Created admin user ${email}.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('create-admin failed:', err);
  process.exit(1);
});
