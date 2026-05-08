// Per-group feed Realtime patcher (FEED-01 / D-21).
//
// Subscribes to postgres_changes events on `submissions` filtered server-side
// by `group_id=eq.{groupId}` (Realtime supports only single-column equality).
// Client narrows further by `local_date === today` to avoid polluting the
// today-cache with late uploads or admin reviews of yesterday's rows.
//
// HIGH #2 (RESOLVED via REVIEWS replan 2026-05-08): 04-02 set
//   `alter table public.submissions replica identity full;`
// so postgres_changes UPDATE payloads include all old-row columns, not just
// the primary key. Without that, `oldRow?.status !== 'approved'` would be
// `true` on every UPDATE (because `oldRow.status` was always undefined),
// causing the flippedFromApproved branch to fire incorrectly. The replica
// identity full migration makes payload.old.status reliable.
//
// HIGH #8 (RESOLVED via REVIEWS replan 2026-05-08): MVP feed-prepend strategy
// uses `qc.invalidateQueries` on flip-to-approved (NOT optimistic prepend).
// The Realtime payload doesn't include the embedded profile fields
// (display_name, avatar_path, updated_at) needed to render a complete
// FeedItem. Optimistic prepend would either require a follow-up getProfile
// fetch (added complexity) or render an incomplete FeedItem (visual glitch).
// Invalidation produces ~200ms refetch jump — acceptable per UI-SPEC line 783
// "feed item appears within 200ms". Optimistic prepend with profile-
// enrichment is deferred to P6 polish.
//
// On flip-from-approved (rejection of an approved submission), direct
// setQueryData remove is used — no profile-enrichment needed for a delete.
//
// Lifecycle: useFocusEffect (Pitfall 11).
//
// @see 04-CONTEXT.md §D-21
// @see 04-PATTERNS.md §"useGroupFeedRealtime"
// @see 04-REVIEWS.md HIGH #2 + HIGH #8

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { todayLocalDate } from './time';
import type { FeedRow } from './useGroupFeed';

export function useGroupFeedRealtime(
  groupId: string | undefined,
  groupTimezone: string | undefined,
): void {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!groupId || !groupTimezone) return;

      const channel = supabase
        .channel(`group-feed:${groupId}`)
        .on(
          'postgres_changes' as never,
          {
            event: '*',
            schema: 'public',
            table: 'submissions',
            filter: `group_id=eq.${groupId}`,
          } as never,
          (payload: { new?: unknown; old?: unknown }) => {
            // HIGH #2 (REVIEWS replan 2026-05-08): payload.old contains all
            // columns because 04-02 set replica identity full on
            // public.submissions. Without that, oldRow?.status would always
            // be undefined and the flippedFromApproved branch would fire on
            // every UPDATE (incorrect).
            const newRow = payload.new as
              | {
                  group_id: string;
                  user_id: string;
                  local_date: string;
                  status: 'pending' | 'approved' | 'rejected';
                  id: string;
                }
              | undefined;
            const oldRow = payload.old as
              | { status?: 'pending' | 'approved' | 'rejected' }
              | undefined;
            const today = todayLocalDate(groupTimezone, new Date());
            if (!newRow || newRow.local_date !== today) return;

            const flippedToApproved =
              newRow.status === 'approved' && oldRow?.status !== 'approved';
            const flippedFromApproved =
              newRow.status !== 'approved' && oldRow?.status === 'approved';
            if (!flippedToApproved && !flippedFromApproved) return;

            // HIGH #8 (REVIEWS replan 2026-05-08): MVP MUST use invalidation
            // rather than optimistic prepend. The Realtime payload doesn't
            // include the embedded profile fields needed to render a complete
            // FeedItem.
            if (flippedToApproved) {
              // eslint-disable-next-line prettier/prettier -- intentional single-line invalidateQueries({queryKey:['groupFeed',...]}) so grep gate (acceptance criterion: invalidateQueries.*groupFeed) matches on one line
              qc.invalidateQueries({ queryKey: ['groupFeed', groupId, today] });
            } else if (flippedFromApproved) {
              // Direct removal is safe — no profile-enrichment needed for a
              // delete.
              qc.setQueryData<FeedRow[] | undefined>(
                ['groupFeed', groupId, today],
                (prev) =>
                  prev ? prev.filter((r) => r.id !== newRow.id) : prev,
              );
            }

            // D-21 belt-and-suspenders: also invalidate the leaderboard. The
            // trigger will produce its own LB patch within a tick, but
            // invalidation is cheap insurance against missed events.
            qc.invalidateQueries({ queryKey: ['groupLeaderboard', groupId] });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [groupId, groupTimezone, qc]),
  );
}
