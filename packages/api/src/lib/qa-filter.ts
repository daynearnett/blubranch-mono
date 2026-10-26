import type { Prisma } from '@blubranch/db';

/**
 * Email domains/suffixes reserved for scripts and automated tests — never a
 * real signup. Used by `staging-verify.ts`, `verify-moderation.ts`, vitest
 * fixtures, and the smoke-test convention documented in CLAUDE.md
 * (`zz-smoketest-...@blubranch-qa.invalid`). These scripts create throwaway
 * accounts directly against a live database and never clean them up, so
 * they accumulate forever and pollute `/network/suggestions` and people
 * search with junk like "Verify Owner", "Cmp Probe", "Gate Smoketest".
 */
export const QA_EMAIL_SUFFIXES = ['@example.com', '@blubranch-qa.invalid', '@test.local'] as const;

/** Prisma `WHERE NOT (...)` fragment that excludes known QA/script accounts. */
export function excludeQaAccountsWhere(): Prisma.UserWhereInput {
  return {
    NOT: {
      OR: QA_EMAIL_SUFFIXES.map((suffix) => ({
        email: { endsWith: suffix, mode: 'insensitive' as const },
      })),
    },
  };
}
