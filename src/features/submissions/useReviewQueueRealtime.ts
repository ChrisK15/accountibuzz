// Per-group admin pending-review Realtime patcher (closes 03-VERIFICATION
// item 2 — D-01..D-04).
//
// Subscribes to postgres_changes events on `submissions` filtered server-side
// by `group_id=eq.{groupId}` (Realtime supports only single-column equality —
// P3 D-13). Client narrows further to events that touch the pending set
// (INSERT with status='pending', or UPDATE where oldRow.status='pending').
//
// Q1 RESOLUTION (channel-naming): distinct channel names per mount point
// (`review-queue:{groupId}:{mountPoint}`) — supabase-js does NOT auto-de-dup
// identical channel names. Each `.channel()` call creates a fresh
// client-side channel; duplicate names overlap during native-stack pushes
// and corrupt subscriptions ("subscribe can only be called a single time
// per channel instance"). See 03.1-RESEARCH.md §Q1 (Discussion #27142,
// Issue #1440).
//
// HIGH (replica identity full): The P4 migration `20260508233129` set
// `replica identity full` on `public.submissions`, making `payload.old.status`
// reliable for narrowing UPDATE events. Without it, `oldRow.status` would
// always be undefined for UPDATEs and the `flippedFromPending` branch would
// fire on every UPDATE.
//
// HIGH (invalidate-don't-prepend): Realtime payload omits the embedded
// profile fields (display_name, avatar_path, profile_updated_at) the
// `get_pending_review_queue` RPC returns; optimistic prepend would render
// incomplete SwipeCards. Invalidate both consumer query keys and let
// TanStack refetch (~200ms — same envelope as P4 feed).
//
// Lifecycle: useFocusEffect (Pitfall #11). Tab navigation does NOT unmount
// the screen — useEffect cleanup would leak the channel forever.
//
// @see 03.1-CONTEXT.md §D-01..D-04
// @see 03.1-RESEARCH.md §Pattern 2 + Q1
// @see 03.1-PATTERNS.md §"NEW src/features/submissions/useReviewQueueRealtime.ts"

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useReviewQueueRealtime(
  groupId: string | undefined,
  mountPoint: 'badge' | 'list',
): void {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;

      const channel = supabase
        .channel(`review-queue:${groupId}:${mountPoint}`)
        .on(
          'postgres_changes' as never,
          {
            event: '*',
            schema: 'public',
            table: 'submissions',
            filter: `group_id=eq.${groupId}`,
          } as never,
          (payload: { new?: unknown; old?: unknown }) => {
            const newRow = payload.new as
              | { status: 'pending' | 'approved' | 'rejected'; id: string }
              | undefined;
            const oldRow = payload.old as
              | { status?: 'pending' | 'approved' | 'rejected' }
              | undefined;

            // Pending-set narrowing — three structural cases:
            //   1. INSERT with status='pending' (no old payload — supabase
            //      Realtime omits `old` from INSERT events; `!oldRow` is the
            //      correct shape check, mirrors useGroupFeedRealtime line 67).
            //   2. UPDATE where oldRow.status='pending' (review just
            //      happened — admin approved or rejected the submission).
            //   3. UPDATE where newRow.status='pending' but oldRow.status was
            //      something else (defensive — shouldn't happen via UI but
            //      possible via direct DB write or RPC re-flow).
            const insertedPending = !oldRow && newRow?.status === 'pending';
            const flippedFromPending =
              oldRow?.status === 'pending' && newRow?.status !== 'pending';
            const flippedToPending =
              oldRow?.status &&
              oldRow.status !== 'pending' &&
              newRow?.status === 'pending';

            if (!insertedPending && !flippedFromPending && !flippedToPending) {
              return;
            }

            qc.invalidateQueries({ queryKey: ['reviewQueue', groupId] });
            qc.invalidateQueries({ queryKey: ['pendingReviewCount', groupId] });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [groupId, mountPoint, qc]),
  );
}
