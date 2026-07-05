-- Timestamped job-view events → powers the Views-over-time line on the
-- employer analytics dashboard. `jobs.view_count` remains the fast total.
CREATE TABLE "job_views" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_views_job_id_created_at_idx" ON "job_views"("job_id", "created_at");

ALTER TABLE "job_views" ADD CONSTRAINT "job_views_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
