// applyAlpha — converts hsl(...) tokens + 0..1 alpha into valid hsla(...) strings.
// HIGH #5 from REVIEWS replan 2026-05-08 — this is the canonical helper consumers
// (MissedYesterdayRow Task 3, 04-05 empty-leaderboard callout) MUST use instead
// of the broken `t.colors.surfaceMuted + '66'` hex-suffix idiom.

import { applyAlpha } from '../../src/theme/applyAlpha';

describe('applyAlpha', () => {
  it('converts comma-separated hsl + alpha to hsla', () => {
    expect(applyAlpha('hsl(220, 14%, 92%)', 0.4)).toBe(
      'hsla(220, 14%, 92%, 0.4)',
    );
  });

  it('clamps alpha values above 1 to 1', () => {
    expect(applyAlpha('hsl(220, 14%, 92%)', 1.5)).toBe(
      'hsla(220, 14%, 92%, 1)',
    );
  });

  it('clamps alpha values below 0 to 0', () => {
    expect(applyAlpha('hsl(220, 14%, 92%)', -0.5)).toBe(
      'hsla(220, 14%, 92%, 0)',
    );
  });

  it('returns input unchanged for non-hsl strings (defensive fallback)', () => {
    expect(applyAlpha('#FFDE42', 0.4)).toBe('#FFDE42');
    expect(applyAlpha('rgb(0, 0, 0)', 0.4)).toBe('rgb(0, 0, 0)');
  });
});
