// tests/intl-supportedvaluesof-probe.test.ts
//
// Wave 0 probe for 02-RESEARCH.md §Pitfall 4 / §A2:
// Hermes iOS under SDK 55 MAY not provide Intl.supportedValuesOf.
// Plan 03's src/features/groups/timezones.ts ships a static fallback; this test
// nails down the try/typeof/catch shape downstream code will use.
//
// The actual live-device probe happens during manual UAT after `npx expo run:ios`.
// This Jest-level probe locks the fallback CONTRACT so the fallback path is exercised.

type ProbeResult = 'intl' | 'fallback';

function probeSupportedValuesOf(intlRef: typeof Intl): ProbeResult {
  try {
    const fn = (intlRef as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (typeof fn !== 'function') return 'fallback';
    const zones = fn('timeZone');
    if (!Array.isArray(zones) || zones.length < 50) return 'fallback';
    return 'intl';
  } catch {
    return 'fallback';
  }
}

describe('Intl.supportedValuesOf probe (plan 03 fallback contract)', () => {
  const originalFn = (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf;

  afterEach(() => {
    if (originalFn === undefined) {
      delete (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf;
    } else {
      (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf = originalFn;
    }
  });

  it('returns "intl" when supportedValuesOf is a function returning a populated array', () => {
    (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf =
      () => Array.from({ length: 60 }, (_, i) => `Zone/${i}`);
    expect(probeSupportedValuesOf(Intl)).toBe('intl');
  });

  it('returns "fallback" when supportedValuesOf is undefined', () => {
    delete (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf;
    expect(probeSupportedValuesOf(Intl)).toBe('fallback');
  });

  it('returns "fallback" when supportedValuesOf throws', () => {
    (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf =
      () => {
        throw new Error('Hermes gremlin');
      };
    expect(probeSupportedValuesOf(Intl)).toBe('fallback');
  });

  it('returns "fallback" when supportedValuesOf returns a too-short list (<50 zones)', () => {
    (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf =
      () => ['UTC', 'America/Los_Angeles'];
    expect(probeSupportedValuesOf(Intl)).toBe('fallback');
  });

  it('records the observed native Jest-runtime typeof for documentation', () => {
    // This is not a fail-if-missing test — Node 22 ships `Intl.supportedValuesOf`,
    // but Hermes iOS may not. Log the observed value so SUMMARY.md can record it.
    // eslint-disable-next-line no-console
    console.log(
      '[intl-probe] typeof Intl.supportedValuesOf (Jest runtime):',
      typeof (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf,
    );
    // No assertion — documentary test.
    expect(true).toBe(true);
  });
});
