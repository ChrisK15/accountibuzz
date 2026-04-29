/**
 * src/features/submissions/time.ts
 *
 * IANA-timezone-aware date helpers for Phase 3 cutoff hint + today narrowing.
 * Uses native Intl.DateTimeFormat — no luxon dep (per RESEARCH §Don't Hand-Roll line 660).
 *
 * Source of truth: 03-UI-SPEC.md §"Cutoff hint copy" (lines 346-357).
 *
 * PER REVIEWS.md C2 (DST safety): the cutoff math computes next group-local midnight
 * via `addOneDay` (calendar-correct UTC date arithmetic on a YYYY-MM-DD string)
 * + `epochForLocalInTz` (resolves the local wall-clock to a UTC epoch using
 * the offset in effect on THAT day). NEVER `todayMidnightEpoch + 86_400_000`
 * — that breaks on DST transitions where local midnight-to-midnight is 23h or 25h.
 */

export type CutoffUrgency = 'normal' | 'destructive-medium' | 'destructive-high';

export type CutoffState = {
  /** Pretty cutoff time in the group's tz. Always group-local midnight, displayed as '12:00 AM' since cutoff IS midnight. */
  cutoffTime: string;
  /** Minutes from now to next group-local-midnight. Floored to 0 if already past. */
  minutesLeft: number;
  /** Per UI-SPEC: normal (≥60min), destructive-medium (5..60min), destructive-high (<5min). */
  urgency: CutoffUrgency;
};

/**
 * Compute the cutoff state for a group at a given moment.
 * Cutoff = next group-local midnight. Minutes-left = floor((cutoffEpoch - now) / 60_000).
 */
export function cutoffStateFor(args: { timezone: string; now?: Date }): CutoffState {
  const { timezone, now = new Date() } = args;

  // Cutoff is always midnight, displayed as 12:00 AM. Per CONTEXT — no per-group
  // custom cutoff time (that's Out of Scope per REQUIREMENTS).
  const cutoffTime = '12:00 AM';

  // Format `now` as a date in the group's tz to extract Y/M/D.
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = dateParts.find((p) => p.type === 'year')!.value;
  const m = dateParts.find((p) => p.type === 'month')!.value;
  const d = dateParts.find((p) => p.type === 'day')!.value;

  // PER REVIEWS.md C2 (DST safety): construct next-day's date STRING (not epoch arithmetic).
  // On DST transition days (spring-forward / fall-back), local midnight-to-midnight is
  // 23h or 25h, NOT 24h. Adding 86_400_000ms would put the cutoff one hour off.
  // Each `epochForLocalInTz` call recomputes the offset for THAT moment, so each
  // midnight is correctly anchored regardless of DST.
  const nextDateStr = addOneDay(`${y}-${m}-${d}`); // "YYYY-MM-DD" + 1 day
  const nextMidnightLocalStr = `${nextDateStr}T00:00:00`;
  const nextMidnightEpoch = epochForLocalInTz(nextMidnightLocalStr, timezone);

  const minutesLeft = Math.max(
    0,
    Math.floor((nextMidnightEpoch - now.getTime()) / 60_000),
  );

  let urgency: CutoffUrgency = 'normal';
  if (minutesLeft < 5) urgency = 'destructive-high';
  else if (minutesLeft < 60) urgency = 'destructive-medium';

  return { cutoffTime, minutesLeft, urgency };
}

/**
 * Convert a group-local-tz wall-clock string (YYYY-MM-DDTHH:mm:ss) to an epoch ms.
 *
 * Uses the well-known Intl trick: format the candidate UTC epoch in the target tz,
 * compare to the desired wall-clock, adjust by the offset in effect at that moment.
 *
 * Each call recomputes the offset, so DST transition correctness comes for free.
 */
function epochForLocalInTz(localStr: string, timezone: string): number {
  // Parse the local string AS IF it were UTC.
  const naiveUtc = Date.parse(`${localStr}Z`);
  // Format that UTC moment in the target tz to find what it "looks like" there.
  const tzFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = tzFmt.formatToParts(new Date(naiveUtc));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // Intl en-CA hourCycle for hour12=false sometimes returns '24:00:00' instead of '00:00:00'
  // for midnight; normalize that.
  const hourRaw = get('hour');
  const hourNorm = hourRaw === '24' ? '00' : hourRaw;
  const seenLocal = `${get('year')}-${get('month')}-${get('day')}T${hourNorm}:${get('minute')}:${get('second')}`;
  const seenUtc = Date.parse(`${seenLocal}Z`);
  // The diff is the tz offset. Apply it backward to get the epoch that produces
  // the desired wall-clock in the target tz.
  const offset = seenUtc - naiveUtc;
  return naiveUtc - offset;
}

/**
 * PER REVIEWS.md C2 (DST safety): add one day to a YYYY-MM-DD date string.
 *
 * Uses `Date.UTC` arithmetic (immune to local-time DST since we work with a
 * date-only value treated as UTC). This produces calendar-correct next day
 * across month/year boundaries (2026-04-30 → 2026-05-01, 2026-12-31 → 2027-01-01).
 *
 * The result is then handed to `epochForLocalInTz` which independently resolves
 * the next day's local-midnight in the target IANA timezone — that call applies
 * whatever DST offset is in effect on that next day, so spring-forward and
 * fall-back boundaries are correctly handled.
 */
function addOneDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map((s) => parseInt(s, 10));
  const utcMs = Date.UTC(y, m - 1, d) + 24 * 60 * 60 * 1000;
  const next = new Date(utcMs);
  const yy = next.getUTCFullYear().toString().padStart(4, '0');
  const mm = (next.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = next.getUTCDate().toString().padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Human-readable "submitted N{m|h} ago" label per UI-SPEC line 357.
 * <60s → 'just now'. <60m → 'Nm ago'. <24h → 'Nh ago'. ≥24h → null (caller hides the row).
 */
export function submittedAgoLabel(
  submittedAtIso: string,
  now: Date = new Date(),
): string | null {
  const submittedAt = Date.parse(submittedAtIso);
  const deltaSec = Math.floor((now.getTime() - submittedAt) / 1000);
  if (deltaSec < 60) return 'just now';
  if (deltaSec < 60 * 60) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 24 * 60 * 60) return `${Math.floor(deltaSec / 60 / 60)}h ago`;
  return null;
}

/**
 * Today's local date in YYYY-MM-DD format for the group's timezone.
 * Used by useTodaySubmission's query key + Realtime client-side narrowing.
 */
export function todayLocalDate(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}
