-- Tagging connections in posts/comments → mention notifications.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'post_mention';

ALTER TABLE "user_settings" ADD COLUMN "notify_mentions" BOOLEAN NOT NULL DEFAULT true;
