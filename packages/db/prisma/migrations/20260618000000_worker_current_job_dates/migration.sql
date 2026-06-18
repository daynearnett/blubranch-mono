-- Current-job start/end dates captured in onboarding (YYYY-MM, month precision).
-- Additive + nullable, so safe to apply on existing rows.
ALTER TABLE "worker_profiles" ADD COLUMN "current_start_date" VARCHAR(7);
ALTER TABLE "worker_profiles" ADD COLUMN "current_end_date" VARCHAR(7);
