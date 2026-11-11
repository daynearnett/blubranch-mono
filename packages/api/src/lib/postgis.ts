// Runtime feature flag for PostGIS-dependent queries.
//
// Local dev (Docker postgis/postgis) and production-grade Postgres
// instances ship with PostGIS, so the default is "on". Railway's stock
// Postgres doesn't have PostGIS available, so we set
// `POSTGIS_ENABLED=false` on Railway services. With it off:
//   - GET /jobs radius search (?lat&lng&radius) and distance fields fall
//     back to a plain-SQL Haversine calculation over jobs.lat/jobs.lng
//     (see routes/jobs.ts) — real filtering, just without the GiST index.
//   - the home feed's distance field is skipped (worker_profiles has no
//     lat/lng fallback columns yet, only the PostGIS-only geo point).

export function isPostGisEnabled(): boolean {
  const raw = process.env.POSTGIS_ENABLED;
  if (raw === undefined) return true; // default ON for safe local dev
  return raw.toLowerCase() === 'true' || raw === '1';
}
