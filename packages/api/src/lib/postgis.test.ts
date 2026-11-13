import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Each test re-imports the module fresh so `geoColumnConfirmedMissing`
// (module-level state) doesn't leak between cases.
async function freshPostgisModule() {
  vi.resetModules();
  return import('./postgis.js');
}

describe('postgis runtime capability detection', () => {
  const prevEnabled = process.env.POSTGIS_ENABLED;

  beforeEach(() => {
    delete process.env.POSTGIS_ENABLED;
  });

  afterEach(() => {
    if (prevEnabled === undefined) delete process.env.POSTGIS_ENABLED;
    else process.env.POSTGIS_ENABLED = prevEnabled;
  });

  it('defaults to enabled when POSTGIS_ENABLED is unset', async () => {
    const { isPostGisEnabled } = await freshPostgisModule();
    expect(isPostGisEnabled()).toBe(true);
  });

  it('respects POSTGIS_ENABLED=false', async () => {
    process.env.POSTGIS_ENABLED = 'false';
    const { isPostGisEnabled } = await freshPostgisModule();
    expect(isPostGisEnabled()).toBe(false);
  });

  it('recognizes a Postgres "undefined column" (42703) error', async () => {
    const { isGeoColumnMissingError } = await freshPostgisModule();
    expect(isGeoColumnMissingError({ meta: { code: '42703' } })).toBe(true);
    expect(isGeoColumnMissingError({ meta: { code: '23505' } })).toBe(false);
    expect(isGeoColumnMissingError(new Error('boom'))).toBe(false);
    expect(isGeoColumnMissingError(null)).toBe(false);
  });

  it('markGeoColumnMissing flips isPostGisEnabled to false for the rest of the process, even though POSTGIS_ENABLED still says on', async () => {
    const { isPostGisEnabled, markGeoColumnMissing } = await freshPostgisModule();
    expect(isPostGisEnabled()).toBe(true); // unset → default on
    markGeoColumnMissing();
    expect(isPostGisEnabled()).toBe(false); // the real schema disagreed — trust that instead
    expect(process.env.POSTGIS_ENABLED).toBeUndefined(); // env var itself is untouched
  });

  it('markGeoColumnMissing only logs once even when called repeatedly', async () => {
    const { markGeoColumnMissing } = await freshPostgisModule();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    markGeoColumnMissing();
    markGeoColumnMissing();
    markGeoColumnMissing();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
