// Subscribe to submissions postgres_changes for THIS user only.
//
// Filter: only single-column equality is supported by Supabase Realtime
// (verified via supabase docs + GitHub realtime-js #97). We filter on
// `user_id=eq.{userId}` (the most-selective security-relevant column) and
// narrow client-side in the handler.
//
// Lifecycle: useFocusEffect (NOT useEffect) — fires on tab focus AND blur.
// Tab navigation does not unmount the screen, so a useEffect cleanup would
// leak the channel forever (Pitfall 11).
//
// PER REVIEWS.md C1 (HIGH — cache pollution fix):
// The handler computes today's local-date for the row's group timezone via
// `todayLocalDate(groupTz, new Date())` and REJECTS any event whose
// `row.local_date !== that_today`. Without this gate, a late upload for
// yesterday OR an admin reviewing a previous day's submission would
// overwrite the user's "today" status with stale data — a visible bug
// where the GroupCard's StatusPill flips to "Approved" / "Today didn't
// count" based on yesterday's row.
//
// The cache patch uses the date-aware key `['submission', row.group_id,
// row.local_date]` to match the new useTodaySubmission query key (which
// also includes the local-date string, per C1 fix).
//
// @see 03-RESEARCH.md §Pattern 3 (lines 486-531)
// @see 03-CONTEXT.md §D-13 (revised — single-column filter + client narrowing)
// @see UI-SPEC §"Realtime status-change copy" (lines 434-442) — visual contract

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { todayLocalDate } from './time';

export function useTodaySubmissionRealtime(
  userId: string | undefined,
  // PER REVIEWS.md C1: callable so the handler always reads the LATEST timezone
  // map (group memberships can change while the channel is live). Caller (Today
  // screen) passes a stable function returning Map<groupId, timezone>.
  getGroupTzs: () => Map<string, string>,
): void {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      const channel = supabase
        .channel(`today-submissions:${userId}`)
        .on(
          // Cast literal to the typed channel.on enum without a TS-friendly
          // top-level type alias here; eslint disallows `any`, so use unknown.
          'postgres_changes' as never,
          {
            event: '*', // INSERT (own submit) + UPDATE (review)
            schema: 'public',
            table: 'submissions',
            filter: `user_id=eq.${userId}`,
          } as never,
          (payload: { new?: unknown; old?: unknown }) => {
            const row = (payload.new ?? payload.old) as
              | { group_id: string; local_date: string; status: string; id: string }
              | undefined;
            if (!row) return;

            // PER REVIEWS.md C1: date-aware narrowing.
            // Look up the active group's timezone; compute today's local-date
            // for that tz; reject any row whose local_date is not today.
            const tzMap = getGroupTzs();
            const groupTz = tzMap.get(row.group_id);
            if (!groupTz) {
              // The user is not currently in this group (or the screen has not
              // hydrated the tz map yet) — ignore the event.
              return;
            }
            const today = todayLocalDate(groupTz, new Date());
            if (row.local_date !== today) {
              // Yesterday/tomorrow event — DO NOT pollute the today cache.
              return;
            }

            // Survived narrowing → patch the date-aware cache key.
            qc.setQueryData(['submission', row.group_id, row.local_date], row);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [userId, qc, getGroupTzs]),
  );
}
