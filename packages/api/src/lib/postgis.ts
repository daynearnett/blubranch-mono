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

// Flips to true the first time a PostGIS-dependent raw query fails because
// the "geo" column doesn't actually exist (see markGeoColumnMissing below),
// even though POSTGIS_ENABLED says it should. Once flipped, every call site
// in this process treats PostGIS as off for the rest of its lifetime instead
// of repeating the same crash on every request.
let geoColumnConfirmedMissing = false;

export function isPostGisEnabled(): boolean {
  if (geoColumnConfirmedMissing) return false;
  const raw = process.env.POSTGIS_ENABLED;
  if (raw === undefined) return true; // default ON for safe local dev
  return raw.toLowerCase() === 'true' || raw === '1';
}

/** Postgres SQLSTATE for "undefined column". */
const UNDEFINED_COLUMN = '42703';

/**
 * True when `err` is a Prisma raw-query error caused specifically by a
 * missing column (Postgres code 42703) — as opposed to any other failure,
 * which callers should still let propagate.
 */
export function isGeoColumnMissingError(err: unknown): boolean {
  const meta = (err as { meta?: { code?: unknown } } | null | undefined)?.meta;
  return meta?.code === UNDEFINED_COLUMN;
}

/**
 * Record that the "geo" geography column doesn't actually exist on this
 * database, despite POSTGIS_ENABLED. This can happen whenever the schema
 * was synced without running the raw-SQL migration that adds it (e.g.
 * `prisma db push`, which only applies schema.prisma and can't model
 * PostGIS types) — including on a Postgres that genuinely has the PostGIS
 * extension installed. Logs once; subsequent calls are silent.
 */
export function markGeoColumnMissing(): void {
  if (geoColumnConfirmedMissing) return;
  geoColumnConfirmedMissing = true;
  console.warn(
    '[postgis] "geo" column missing despite POSTGIS_ENABLED — falling back to the non-PostGIS path for the rest of this process.',
  );
}
