-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'profile_view';
ALTER TYPE "NotificationType" ADD VALUE 'profile_nudge';

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "notify_profile_nudges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_profile_views" BOOLEAN NOT NULL DEFAULT true;

