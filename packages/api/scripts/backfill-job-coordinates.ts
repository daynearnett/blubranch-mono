/**
 * Re-geocode every open/draft job once `GOOGLE_MAPS_API_KEY` is actually set
 * on the environment (see docs — this script is useless without it; without
 * the key `geocodeAddress()` just returns the same Chicago-anchored fallback
 * it already wrote). Until the key is set, EVERY job on staging geocodes to
 * a point near Chicago regardless of its real city, which makes
 * radius-based `/jobs` search look broken for any real user searching from
 * their own location — the underlying Haversine math is fine (confirmed
 * live 2026-11-18); this is the only thing masking it.
 *
 * Run INSIDE the Railway container (same pattern as other maintenance
 * scripts here), AFTER setting GOOGLE_MAPS_API_KEY on the service:
 *   railway ssh --service blubranch \
 *     "cd /app/packages/api && node_modules/.bin/tsx scripts/backfill-job-coordinates.ts"
 *
 * Only touches `draft`/`open` jobs (closed/expired listings aren't served
 * by search, so there's no user-facing reason to spend Google quota on
 * them). Safe to re-run.
 */
import { getPrisma } from '../src/lib/prisma.js';
import { geocodeAddress, setGeographyPoint } from '../src/services/geocode.js';

async function main() {
  const prisma = getPrisma();
  const jobs = await prisma.job.findMany({
    where: { status: { in: ['draft', 'open'] } },
    select: { id: true, city: true, state: true, zipCode: true },
  });

  if (jobs.length === 0) {
    console.log('No draft/open jobs to re-geocode.');
    process.exit(0);
  }

  console.log(`Re-geocoding ${jobs.length} job(s)...`);
  let done = 0;
  let realHits = 0;
  for (const job of jobs) {
    const result = await geocodeAddress({ city: job.city, state: job.state, zipCode: job.zipCode });
    if (!result) {
      console.log(`  [skip] ${job.id} — no address to geocode`);
      continue;
    }
    await setGeographyPoint(prisma, 'jobs', job.id, { lat: result.lat, lng: result.lng });
    if (result.source === 'google') realHits++;
    done++;
    console.log(`  [${done}/${jobs.length}] ${job.id} (${job.city}, ${job.state}) -> ${result.source} ${result.lat},${result.lng}`);
  }
  console.log(`DONE — re-geocoded ${done} job(s), ${realHits} via the real Google API.`);
  if (realHits === 0) {
    console.warn('WARNING: zero jobs resolved via Google — GOOGLE_MAPS_API_KEY is probably still unset.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('backfill-job-coordinates failed:', err);
  process.exit(1);
});
