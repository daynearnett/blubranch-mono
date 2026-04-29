-- Add a self-reported license_number column to worker_profiles.
-- The certifications table now exclusively holds named, verifiable credentials.
ALTER TABLE "worker_profiles"
  ADD COLUMN "license_number" VARCHAR(100);

-- Backfill: any rows previously created by the signup wizard with the placeholder
-- name 'Self-reported license' carry the user's number in certifications. Move
-- those values onto worker_profiles.license_number, then drop the placeholder rows.
UPDATE "worker_profiles" wp
SET "license_number" = c."certification_number"
FROM "certifications" c
WHERE c."user_id" = wp."user_id"
  AND c."name" = 'Self-reported license'
  AND c."certification_number" IS NOT NULL
  AND wp."license_number" IS NULL;

DELETE FROM "certifications"
WHERE "name" = 'Self-reported license';
