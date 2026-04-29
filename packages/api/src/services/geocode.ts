// Address → lat/lng for PostGIS storage.
// Uses Google Maps Geocoding API when GOOGLE_MAPS_API_KEY is set; otherwise
// returns a Chicago-anchored fallback so dev databases get usable points
// (with a small zip-derived offset so multiple fixtures don't collide).

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
 * Update the geography(Point, 4326) column on a row. Prisma can't model
 * PostGIS types, so we do this with a raw query each time.
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
  const sql = `UPDATE "${table}" SET "location" = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE "${idColumn}" = $3::uuid`;
  await prisma.$executeRawUnsafe(sql, point.lng, point.lat, id);
}
