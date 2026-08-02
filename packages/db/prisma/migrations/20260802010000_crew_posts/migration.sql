-- Crew posts (E1) — co-authored posts with vouch-style invite/accept.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'coauthor_invite';

CREATE TYPE "CoauthorStatus" AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE "post_coauthors" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "CoauthorStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "post_coauthors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "post_coauthors_post_id_user_id_key" ON "post_coauthors"("post_id", "user_id");
CREATE INDEX "post_coauthors_user_id_status_idx" ON "post_coauthors"("user_id", "status");

ALTER TABLE "post_coauthors" ADD CONSTRAINT "post_coauthors_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_coauthors" ADD CONSTRAINT "post_coauthors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
