-- Phase 3.5 schema additions
-- New enums, columns, and tables added for onboarding, verification,
-- bookmarks, search, and post audience features.

-- ─── New enums ───────────────────────────────────────────────────────────────

CREATE TYPE "PostAudience" AS ENUM ('anyone', 'connections');
CREATE TYPE "LicenseVerificationMethod" AS ENUM ('state_api', 'manual');
CREATE TYPE "WorkplaceVerificationMethod" AS ENUM ('email', 'manual');
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'rejected', 'expired');

-- ─── users: new columns ─────────────────────────────────────────────────────

ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "slug" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "terms_version" VARCHAR(20);

-- phone was NOT NULL in init; schema now allows nullable
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;

CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");

-- ─── trades: is_popular ─────────────────────────────────────────────────────

ALTER TABLE "trades" ADD COLUMN "is_popular" BOOLEAN NOT NULL DEFAULT false;

-- ─── worker_profiles: new columns ───────────────────────────────────────────

ALTER TABLE "worker_profiles" ADD COLUMN "profile_completeness" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "worker_profiles" ADD COLUMN "current_company" VARCHAR(200);
ALTER TABLE "worker_profiles" ADD COLUMN "current_title" VARCHAR(200);
ALTER TABLE "worker_profiles" ADD COLUMN "trade_years" INTEGER;

-- ─── jobs: location fields ──────────────────────────────────────────────────

ALTER TABLE "jobs" ADD COLUMN "location" VARCHAR(200);
ALTER TABLE "jobs" ADD COLUMN "lat" DECIMAL(10,7);
ALTER TABLE "jobs" ADD COLUMN "lng" DECIMAL(10,7);

-- ─── posts: audience + tags ─────────────────────────────────────────────────

ALTER TABLE "posts" ADD COLUMN "audience" "PostAudience" NOT NULL DEFAULT 'anyone';
ALTER TABLE "posts" ADD COLUMN "location_tag" VARCHAR(100);
ALTER TABLE "posts" ADD COLUMN "trade_tag" VARCHAR(100);

-- ─── New table: licenses ────────────────────────────────────────────────────

CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(200) NOT NULL,
    "number" VARCHAR(100) NOT NULL,
    "issuing_state" VARCHAR(2) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verification_method" "LicenseVerificationMethod",
    "verified_at" TIMESTAMP(3),
    "verified_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "licenses_user_id_idx" ON "licenses"("user_id");
CREATE INDEX "licenses_status_idx" ON "licenses"("status");

ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── New table: work_places ─────────────────────────────────────────────────

CREATE TABLE "work_places" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "role" VARCHAR(200) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "location" VARCHAR(200),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verification_method" "WorkplaceVerificationMethod",
    "verified_at" TIMESTAMP(3),
    "verification_email" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_places_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_places_user_id_idx" ON "work_places"("user_id");

ALTER TABLE "work_places" ADD CONSTRAINT "work_places_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── New table: bookmarked_jobs ─────────────────────────────────────────────

CREATE TABLE "bookmarked_jobs" (
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarked_jobs_pkey" PRIMARY KEY ("user_id","job_id")
);

CREATE INDEX "bookmarked_jobs_job_id_idx" ON "bookmarked_jobs"("job_id");

ALTER TABLE "bookmarked_jobs" ADD CONSTRAINT "bookmarked_jobs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookmarked_jobs" ADD CONSTRAINT "bookmarked_jobs_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── New table: search_logs ─────────────────────────────────────────────────

CREATE TABLE "search_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "search_logs_user_id_created_at_idx" ON "search_logs"("user_id", "created_at");

ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
