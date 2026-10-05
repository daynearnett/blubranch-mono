-- Daily task nudges for the focus-group field test: one rotating, basic
-- social task per day (post / like / comment / connect / vouch / toolbox /
-- jobs), pushed to workers at 17:00 UTC.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'daily_task';

ALTER TABLE "user_settings" ADD COLUMN "notify_daily_tasks" BOOLEAN NOT NULL DEFAULT true;
