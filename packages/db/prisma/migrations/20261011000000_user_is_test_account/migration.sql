-- QA/internal probe accounts (created ad hoc while manually testing a flow,
-- e.g. "Cmp Probe", "Verify Owner") were showing up in /network/suggestions
-- mixed in with real strangers, with no way to tell them apart. Give admins
-- a flag to mark an account as test-only so discovery surfaces can exclude
-- it; see PUT /admin/workers/:id/test-account.
ALTER TABLE "users" ADD COLUMN "is_test_account" BOOLEAN NOT NULL DEFAULT false;
