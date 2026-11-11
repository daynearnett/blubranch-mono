// Address → lat/lng for PostGIS storage.
// Uses Google Maps Geocoding API when GOOGLE_MAPS_API_KEY is set; otherwise
// returns a Chicago-anchored fallback so dev databases get usable points
// (with a small zip-derived offset so multiple fixtures don't collide).

import { isPostGisEnabled } from '../lib/postgis.js';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  source: 'google' | 'dev-fallback';
}

const CHICAGO_FALLBACK = { lat: 41.8781, lng: -87.6298 };

function isGoogleConfigured(): boolean {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return Boolean(key && key !== 'replace_me');
}

/**
 * Hash a string to a deterministic small ±0.05° offset (~3 mi at Chicago lat).
 * Keeps dev fixtures from stacking on the exact same point so distance-sort
 * queries return non-zero, varied distances.
 */
function devOffset(seed: string): { lat: number; lng: number } {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const angle = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const radius = (((h >> 16) & 0xff) / 0xff) * 0.05;
  return { lat: Math.sin(angle) * radius, lng: Math.cos(angle) * radius };
}

export async function geocodeAddress(input: {
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  street?: string | null;
}): Promise<GeocodeResult | null> {
  const parts = [input.street, input.city, input.state, input.zipCode]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(', ');

  if (!parts) return null;

  if (!isGoogleConfigured()) {
    const off = devOffset(parts);
    return {
      lat: CHICAGO_FALLBACK.lat + off.lat,
      lng: CHICAGO_FALLBACK.lng + off.lng,
      formattedAddress: parts,
      source: 'dev-fallback',
    };
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', parts);
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    };
    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      return null;
    }
    const loc = data.results[0].geometry.location;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: data.results[0].formatted_address,
      source: 'google',
    };
  } catch (err) {
    console.error('[geocode] failed, falling back to Chicago anchor', err);
    const off = devOffset(parts);
    return {
      lat: CHICAGO_FALLBACK.lat + off.lat,
      lng: CHICAGO_FALLBACK.lng + off.lng,
      formattedAddress: parts,
      source: 'dev-fallback',
    };
  }
}

/**
 * Update a row's location. Prisma can't model PostGIS types, so this is a
 * raw query either way.
 *
 * "jobs" also has plain lat/lng Decimal columns (no PostGIS needed) that
 * GET /jobs uses as a Haversine fallback for radius search when PostGIS
 * isn't available. We write those unconditionally so radius search works
 * on every environment — not just ones with the extension.
 *
 * The geography point itself only exists when PostGIS is enabled (on
 * Railway's stock Postgres the "geo" column is never created at all — see
 * the postgis_geography migration's PostGIS-availability guard), so we
 * skip that write entirely when it's off instead of issuing a query that's
 * guaranteed to fail with "column geo does not exist".
 */
export async function setGeographyPoint(
  prisma: import('@blubranch/db').PrismaClient,
  table: 'jobs' | 'worker_profiles',
  id: string,
  point: { lat: number; lng: number },
  idColumn: 'id' | 'user_id' = 'id',
): Promise<void> {
  // Inline table/column names because $executeRawUnsafe parameterizes values
  // only — both names are checked against a closed enum above. The `$3::uuid`
  // cast is required because Prisma's extended protocol passes parameters as
  // text and Postgres doesn't auto-cast uuid columns.
  if (table === 'jobs') {
    const latLngSql = `UPDATE "jobs" SET "lat" = $1, "lng" = $2 WHERE "${idColumn}" = $3::uuid`;
    await prisma.$executeRawUnsafe(latLngSql, point.lat, point.lng, id);
  }

  if (!isPostGisEnabled()) return;

  const geoSql = `UPDATE "${table}" SET "geo" = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE "${idColumn}" = $3::uuid`;
  await prisma.$executeRawUnsafe(geoSql, point.lng, point.lat, id);
}
