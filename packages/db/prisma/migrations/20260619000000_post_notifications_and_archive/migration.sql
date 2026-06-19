-- Post-like / post-comment notifications + per-type prefs, and post archiving.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'post_like';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'post_comment';

ALTER TABLE "user_settings" ADD COLUMN "notify_post_likes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN "notify_post_comments" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "posts" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
