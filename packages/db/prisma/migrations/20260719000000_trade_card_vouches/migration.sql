-- Trade Card + "worked together" vouches (differentiation sprint).
-- License-expiry reminder notifications, license document photo, and the
-- mutual-attestation Vouch table.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'license_expiry';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'vouch_received';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'vouch_confirmed';

ALTER TABLE "user_settings" ADD COLUMN "notify_license_expiry" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN "notify_vouches" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "licenses" ADD COLUMN "document_url" VARCHAR(500);
ALTER TABLE "licenses" ADD COLUMN "reminded_at" TIMESTAMP(3);

CREATE TYPE "VouchStatus" AS ENUM ('pending', 'confirmed');

CREATE TABLE "vouches" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "vouchee_id" UUID NOT NULL,
    "company_name" VARCHAR(200),
    "start_year" VARCHAR(7),
    "end_year" VARCHAR(7),
    "status" "VouchStatus" NOT NULL DEFAULT 'pending',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vouches_voucher_id_vouchee_id_key" ON "vouches"("voucher_id", "vouchee_id");
CREATE INDEX "vouches_vouchee_id_status_idx" ON "vouches"("vouchee_id", "status");

ALTER TABLE "vouches" ADD CONSTRAINT "vouches_voucher_id_fkey"
    FOREIGN KEY ("voucher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_vouchee_id_fkey"
    FOREIGN KEY ("vouchee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
