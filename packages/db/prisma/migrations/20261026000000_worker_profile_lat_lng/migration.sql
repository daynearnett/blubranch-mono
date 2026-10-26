-- Plain lat/lng mirror of worker_profiles.geo (PostGIS geography point).
-- jobs.lat/lng already existed but were likewise never populated; this
-- migration only adds the missing columns on worker_profiles — the API
-- change that actually writes to all of them, and that reads them back
-- for distance calculation when PostGIS is disabled, ships alongside this
-- migration (see services/geocode.ts, routes/jobs.ts, routes/posts.ts).
ALTER TABLE "worker_profiles" ADD COLUMN "lat" DECIMAL(10,7);
ALTER TABLE "worker_profiles" ADD COLUMN "lng" DECIMAL(10,7);
