-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('worker', 'employer', 'admin');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('email', 'apple', 'google', 'facebook');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('years_0_2', 'years_3_5', 'years_6_10', 'years_11_15', 'years_16_20', 'years_20_plus');

-- CreateEnum
CREATE TYPE "JobAvailability" AS ENUM ('open', 'actively_looking', 'not_looking');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('full_time', 'part_time', 'contract', 'temp_to_hire');

-- CreateEnum
CREATE TYPE "WorkSetting" AS ENUM ('commercial', 'residential', 'industrial', 'mixed');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('draft', 'open', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('basic', 'pro', 'unlimited');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('applied', 'reviewed', 'shortlisted', 'hired', 'rejected');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('size_1_10', 'size_11_50', 'size_51_200', 'size_201_500', 'size_500_plus');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password_hash" VARCHAR(255),
    "role" "Role" NOT NULL,
    "auth_provider" "AuthProvider" NOT NULL,
    "auth_provider_id" VARCHAR(255),
    "profile_photo_url" VARCHAR(500),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "headline" VARCHAR(200),
    "bio" VARCHAR(300),
    "experience_level" "ExperienceLevel" NOT NULL,
    "hourly_rate" DECIMAL(8,2),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "zip_code" VARCHAR(10) NOT NULL,
    "travel_radius_miles" INTEGER NOT NULL,
    "job_availability" "JobAvailability" NOT NULL,
    "union_name" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "open_to_work" BOOLEAN NOT NULL DEFAULT true,
    "show_hourly_rate" BOOLEAN NOT NULL DEFAULT false,
    "show_union" BOOLEAN NOT NULL DEFAULT true,
    "financial_tips" BOOLEAN NOT NULL DEFAULT true,
    "job_alerts" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_trades" (
    "user_id" UUID NOT NULL,
    "trade_id" INTEGER NOT NULL,

    CONSTRAINT "user_trades_pkey" PRIMARY KEY ("user_id","trade_id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "trade_id" INTEGER,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "user_id" UUID NOT NULL,
    "skill_id" INTEGER NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("user_id","skill_id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "certification_number" VARCHAR(100),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "photo_url" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(100),
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "portfolio_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL,

    CONSTRAINT "work_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "industry" VARCHAR(100),
    "size_range" "CompanySize" NOT NULL,
    "website" VARCHAR(500),
    "description" VARCHAR(300),
    "contact_email" VARCHAR(255) NOT NULL,
    "logo_url" VARCHAR(500),
    "established_year" INTEGER,
    "rating" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "trade_id" INTEGER NOT NULL,
    "experience_level" VARCHAR(50) NOT NULL,
    "pay_min" DECIMAL(8,2) NOT NULL,
    "pay_max" DECIMAL(8,2) NOT NULL,
    "job_type" "JobType" NOT NULL,
    "work_setting" "WorkSetting" NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "zip_code" VARCHAR(10) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "openings_count" INTEGER NOT NULL DEFAULT 1,
    "status" "JobStatus" NOT NULL,
    "plan_tier" "PlanTier" NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "boost_push_notification" BOOLEAN NOT NULL DEFAULT false,
    "boost_featured_placement" BOOLEAN NOT NULL DEFAULT false,
    "stripe_payment_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_benefits" (
    "job_id" UUID NOT NULL,
    "benefit_id" INTEGER NOT NULL,

    CONSTRAINT "job_benefits_pkey" PRIMARY KEY ("job_id","benefit_id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'applied',
    "message" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_photos" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "photo_url" VARCHAR(500) NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "post_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("post_id","user_id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsements" (
    "id" UUID NOT NULL,
    "endorser_id" UUID NOT NULL,
    "endorsed_id" UUID NOT NULL,
    "endorser_title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "worker_profiles_user_id_key" ON "worker_profiles"("user_id");

-- CreateIndex
CREATE INDEX "worker_profiles_city_state_idx" ON "worker_profiles"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "trades_name_key" ON "trades"("name");

-- CreateIndex
CREATE UNIQUE INDEX "trades_slug_key" ON "trades"("slug");

-- CreateIndex
CREATE INDEX "user_trades_trade_id_idx" ON "user_trades"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_trade_id_key" ON "skills"("name", "trade_id");

-- CreateIndex
CREATE INDEX "user_skills_skill_id_idx" ON "user_skills"("skill_id");

-- CreateIndex
CREATE INDEX "certifications_user_id_idx" ON "certifications"("user_id");

-- CreateIndex
CREATE INDEX "portfolio_photos_user_id_idx" ON "portfolio_photos"("user_id");

-- CreateIndex
CREATE INDEX "work_history_user_id_idx" ON "work_history"("user_id");

-- CreateIndex
CREATE INDEX "companies_employer_id_idx" ON "companies"("employer_id");

-- CreateIndex
CREATE INDEX "jobs_status_expires_at_idx" ON "jobs"("status", "expires_at");

-- CreateIndex
CREATE INDEX "jobs_trade_id_status_idx" ON "jobs"("trade_id", "status");

-- CreateIndex
CREATE INDEX "jobs_city_state_idx" ON "jobs"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "benefits_name_key" ON "benefits"("name");

-- CreateIndex
CREATE INDEX "job_benefits_benefit_id_idx" ON "job_benefits"("benefit_id");

-- CreateIndex
CREATE INDEX "job_applications_worker_id_idx" ON "job_applications"("worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_job_id_worker_id_key" ON "job_applications"("job_id", "worker_id");

-- CreateIndex
CREATE INDEX "posts_user_id_created_at_idx" ON "posts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "post_photos_post_id_idx" ON "post_photos"("post_id");

-- CreateIndex
CREATE INDEX "post_likes_user_id_idx" ON "post_likes"("user_id");

-- CreateIndex
CREATE INDEX "post_comments_post_id_created_at_idx" ON "post_comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "connections_receiver_id_status_idx" ON "connections"("receiver_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connections_requester_id_receiver_id_key" ON "connections"("requester_id", "receiver_id");

-- CreateIndex
CREATE INDEX "endorsements_endorsed_id_idx" ON "endorsements"("endorsed_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_user_a_id_user_b_id_key" ON "conversations"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trades" ADD CONSTRAINT "user_trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trades" ADD CONSTRAINT "user_trades_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_history" ADD CONSTRAINT "work_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_benefits" ADD CONSTRAINT "job_benefits_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_benefits" ADD CONSTRAINT "job_benefits_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_photos" ADD CONSTRAINT "post_photos_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_endorser_id_fkey" FOREIGN KEY ("endorser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_endorsed_id_fkey" FOREIGN KEY ("endorsed_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
