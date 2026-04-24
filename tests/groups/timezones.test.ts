// Mirrors tests/intl-supportedvaluesof-probe.test.ts Intl mutation pattern.
import { listTimezones, labelFor } from '../../src/features/groups/timezones';

describe('listTimezones()', () => {
  const originalFn = (Intl as unknown as { supportedValuesOf?: unknown })
    .supportedValuesOf;

  afterEach(() => {
    if (originalFn === undefined) {
      delete (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf;
    } else {
      (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf =
        originalFn;
    }
  });

  it('returns the Intl-supplied list when supportedValuesOf works', () => {
    const synthetic = [
      'UTC',
      ...Array.from({ length: 60 }, (_, i) => `Zone/${i}`),
    ];
    (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf =
      () => synthetic;
    const zones = listTimezones();
    expect(zones).toEqual(synthetic);
  });

  it('falls back to static ≥400 entry list when Intl.supportedValuesOf is undefined', () => {
    delete (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf;
    const zones = listTimezones();
    expect(zones.length).toBeGreaterThanOrEqual(400);
    expect(zones).toContain('America/Los_Angeles');
    expect(zones).toContain('Europe/London');
    expect(zones).toContain('Asia/Tokyo');
  });

  it('falls back to static list when Intl.supportedValuesOf throws', () => {
    (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf =
      () => {
        throw new Error('Hermes gremlin');
      };
    const zones = listTimezones();
    expect(zones.length).toBeGreaterThanOrEqual(400);
    expect(zones).toContain('America/Los_Angeles');
  });

  it('falls back to static list when Intl returns a too-short list (<50)', () => {
    (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf =
      () => ['UTC', 'America/Los_Angeles'];
    const zones = listTimezones();
    expect(zones.length).toBeGreaterThanOrEqual(400);
  });
});

describe('labelFor()', () => {
  it('returns a non-empty string containing the IANA name for a real zone', () => {
    const label = labelFor('America/Los_Angeles');
    expect(label).toContain('America/Los_Angeles');
    expect(label.length).toBeGreaterThan(0);
  });

  it('does not throw for an unknown zone (returns input as fallback)', () => {
    expect(() => labelFor('Not/A/Zone')).not.toThrow();
    expect(labelFor('Not/A/Zone')).toBe('Not/A/Zone');
  });
});
