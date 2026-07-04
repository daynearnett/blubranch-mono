-- Multi-select trades + job types on a job (primary tradeId/jobType retained).
ALTER TABLE "jobs" ADD COLUMN "trade_ids" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "jobs" ADD COLUMN "job_types" "JobType"[] NOT NULL DEFAULT '{}';
