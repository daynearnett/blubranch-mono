-- Per-job view counter for the employer analytics funnel.
ALTER TABLE "jobs" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;
