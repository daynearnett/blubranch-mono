-- PostGIS geography columns + GiST indexes for radius search.
-- Runs AFTER init so the worker_profiles and jobs tables exist.
--
-- Wrapped in DO blocks so the entire migration succeeds even when
-- PostGIS isn't available on the target Postgres (e.g. Railway's stock
-- image). When PostGIS is missing the `geography` type doesn't exist
-- and the ALTER TABLE / CREATE INDEX statements would otherwise abort
-- the migration. The exception handler converts those failures into
-- harmless NOTICEs.
--
-- The API checks the POSTGIS_ENABLED env var at runtime to decide
-- whether to issue geography-aware queries. When the env var is unset
-- or "false", the API skips lat/lng filtering and distance sorting and
-- relies on text-based filters only.

-- NOTE: the geography point column is named "geo" (not "location"). A later
-- migration (phase_3_5) adds a human-readable "location" VARCHAR(200) to jobs,
-- so the geospatial point must use a distinct name to avoid a collision on
-- PostGIS-enabled databases where this migration's ADD COLUMN actually runs.

DO $$
BEGIN
  ALTER TABLE "worker_profiles"
    ADD COLUMN IF NOT EXISTS "geo" geography(Point, 4326);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping worker_profiles.geo (PostGIS unavailable): %', SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE "jobs"
    ADD COLUMN IF NOT EXISTS "geo" geography(Point, 4326);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping jobs.geo (PostGIS unavailable): %', SQLERRM;
END
$$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "worker_profiles_geo_gix"
    ON "worker_profiles" USING GIST ("geo");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping worker_profiles_geo_gix index: %', SQLERRM;
END
$$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "jobs_geo_gix"
    ON "jobs" USING GIST ("geo");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping jobs_geo_gix index: %', SQLERRM;
END
$$;
