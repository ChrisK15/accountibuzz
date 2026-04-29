// PER REVIEWS.md C2 (HIGH — core mechanic): the cutoff timer drives the
// streak-reset cron in P5; off-by-one-hour math here is foundational, not
// low-risk. This file covers DST boundaries explicitly.
import {
  cutoffStateFor,
  todayLocalDate,
  submittedAgoLabel,
} from '../../src/features/submissions/time';

describe('cutoffStateFor (PER REVIEWS.md C2 — DST safety)', () => {
  // Spring-forward in America/Los_Angeles: 2026-03-08 02:00 PST → 03:00 PDT (skip 02:00-03:00).
  it('spring-forward: PST→PDT in America/Los_Angeles, 2026-03-08', () => {
    // "now" = 2026-03-08 22:00 PDT (UTC-7) = 2026-03-09 05:00 UTC.
    // Spring-forward already happened earlier in the day, so 22:00→24:00 = 120 min.
    const now = new Date('2026-03-09T05:00:00Z');
    const r = cutoffStateFor({ timezone: 'America/Los_Angeles', now });
    expect(Math.abs(r.minutesLeft - 120)).toBeLessThanOrEqual(1);
    expect(r.urgency).toBe('normal');
  });

  // Fall-back in America/New_York: 2026-11-01 02:00 EDT → 01:00 EST.
  it('fall-back: EDT→EST in America/New_York, 2026-11-01', () => {
    // "now" = 2026-11-01 22:00 EST (UTC-5) = 2026-11-02 03:00 UTC.
    const now = new Date('2026-11-02T03:00:00Z');
    const r = cutoffStateFor({ timezone: 'America/New_York', now });
    expect(Math.abs(r.minutesLeft - 120)).toBeLessThanOrEqual(1);
    expect(r.urgency).toBe('normal');
  });

  it('no-DST baseline: UTC', () => {
    const now = new Date('2026-04-28T22:30:00Z');
    const r = cutoffStateFor({ timezone: 'UTC', now });
    expect(Math.abs(r.minutesLeft - 90)).toBeLessThanOrEqual(1);
  });

  it('no-DST baseline: Pacific/Kiritimati (UTC+14)', () => {
    // 22:00 UTC on Apr 28 = 12:00 on Apr 29 in Kiritimati → 12h until next midnight.
    const now = new Date('2026-04-28T22:00:00Z');
    const r = cutoffStateFor({ timezone: 'Pacific/Kiritimati', now });
    expect(Math.abs(r.minutesLeft - 720)).toBeLessThanOrEqual(1);
  });

  it('23:59 boundary returns < 5 minutes (destructive-high urgency)', () => {
    // 23:59:30 PDT (UTC-7) on Apr 28 = 06:59:30 UTC on Apr 29.
    const now = new Date('2026-04-29T06:59:30Z');
    const r = cutoffStateFor({ timezone: 'America/Los_Angeles', now });
    expect(r.minutesLeft).toBeLessThan(5);
    expect(r.urgency).toBe('destructive-high');
  });

  it('returns normal urgency when > 60 minutes remaining', () => {
    // 11am PDT (UTC-7) Apr 28 = 18:00 UTC.
    const now = new Date('2026-04-28T18:00:00Z');
    const r = cutoffStateFor({ timezone: 'America/Los_Angeles', now });
    expect(r.minutesLeft).toBeGreaterThan(60);
    expect(r.urgency).toBe('normal');
  });

  it('returns destructive-medium urgency when 5..60 minutes remaining', () => {
    // 23:30 PDT (UTC-7) Apr 28 = 06:30 UTC Apr 29 → 30 min until midnight.
    const now = new Date('2026-04-29T06:30:00Z');
    const r = cutoffStateFor({ timezone: 'America/Los_Angeles', now });
    expect(r.minutesLeft).toBeGreaterThanOrEqual(5);
    expect(r.minutesLeft).toBeLessThan(60);
    expect(r.urgency).toBe('destructive-medium');
  });

  it('returns "12:00 AM" cutoffTime literal regardless of timezone', () => {
    const now = new Date('2026-04-28T18:00:00Z');
    expect(cutoffStateFor({ timezone: 'America/Los_Angeles', now }).cutoffTime).toBe('12:00 AM');
    expect(cutoffStateFor({ timezone: 'Asia/Tokyo', now }).cutoffTime).toBe('12:00 AM');
    expect(cutoffStateFor({ timezone: 'UTC', now }).cutoffTime).toBe('12:00 AM');
  });
});

describe('todayLocalDate', () => {
  it('returns YYYY-MM-DD for the given timezone', () => {
    const now = new Date('2026-04-28T22:30:00Z');
    expect(todayLocalDate('America/Los_Angeles', now)).toBe('2026-04-28');
    expect(todayLocalDate('Pacific/Kiritimati', now)).toBe('2026-04-29');
  });

  it('handles timezone day-rollover correctly', () => {
    // 23:30 UTC = 16:30 PDT (still Apr 28) but 08:30 next-day in Tokyo (Apr 29).
    const now = new Date('2026-04-28T23:30:00Z');
    expect(todayLocalDate('America/Los_Angeles', now)).toBe('2026-04-28');
    expect(todayLocalDate('Asia/Tokyo', now)).toBe('2026-04-29');
  });
});

describe('submittedAgoLabel', () => {
  const now = new Date('2026-04-28T22:00:00Z');

  it('returns "just now" for < 60s', () => {
    expect(
      submittedAgoLabel(new Date(now.getTime() - 30 * 1000).toISOString(), now),
    ).toBe('just now');
  });
  it('returns "Nm ago" for < 60m', () => {
    expect(
      submittedAgoLabel(
        new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        now,
      ),
    ).toBe('5m ago');
  });
  it('returns "Nh ago" for < 24h', () => {
    expect(
      submittedAgoLabel(
        new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        now,
      ),
    ).toBe('3h ago');
  });
  it('returns null for >= 24h', () => {
    expect(
      submittedAgoLabel(
        new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
        now,
      ),
    ).toBeNull();
  });
});
