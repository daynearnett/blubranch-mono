// Runtime feature flag for PostGIS-dependent queries.
//
// Local dev (Docker postgis/postgis) and production-grade Postgres
// instances ship with PostGIS, so the default is "on". Railway's stock
// Postgres doesn't have PostGIS available, so we set
// `POSTGIS_ENABLED=false` on Railway services and the API skips:
//   - radius-search filters in GET /jobs (?lat&lng&radius)
//   - distance sorting (?sort=nearest)
//   - distance fields in the home feed
//
// The non-geo paths still return correct results — just without
// distance filtering or sorting.

export function isPostGisEnabled(): boolean {
  const raw = process.env.POSTGIS_ENABLED;
  if (raw === undefined) return true; // default ON for safe local dev
  return raw.toLowerCase() === 'true' || raw === '1';
}
