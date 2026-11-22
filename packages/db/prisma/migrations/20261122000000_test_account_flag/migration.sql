-- /network/suggestions' "@*.invalid" junk filter never matched the realistic
-- -looking emails that stripe-e2e / staging-verify / webhook-test / etc.
-- actually use for their throwaway accounts. Add an explicit flag those
-- scripts can set going forward, and that a one-off backfill
-- (scripts/mark-test-accounts.ts) can apply to existing fixture rows.
ALTER TABLE "users" ADD COLUMN "is_test_account" BOOLEAN NOT NULL DEFAULT false;
