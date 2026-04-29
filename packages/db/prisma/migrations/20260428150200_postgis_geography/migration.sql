-- PostGIS geography columns + GiST indexes for radius search.
-- Runs AFTER init so the worker_profiles and jobs tables exist.

ALTER TABLE "worker_profiles"
  ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);

CREATE INDEX IF NOT EXISTS "worker_profiles_location_gix"
  ON "worker_profiles" USING GIST ("location");

CREATE INDEX IF NOT EXISTS "jobs_location_gix"
  ON "jobs" USING GIST ("location");
