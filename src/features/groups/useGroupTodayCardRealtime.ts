// Per-Today-card Realtime patcher (D-15).
//
// Subscribes to postgres_changes UPDATE events on group_members filtered
// server-side by `group_id=eq.{groupId}` (Realtime supports only
// single-column equality). On every event:
//   - Always invalidates `['todaySocialCounts', groupId]` (member counter
//     mutated → posted-today count may have moved)
//   - When `payload.new.user_id === userId`, also invalidates
//     `['groupLeaderboard', groupId]` so the user's own row's points/streak
//     refresh on the Today screen surface even when the LB Realtime channel
//     isn't mounted (Today screen doesn't open the full LB list).
//
// This hook is mounted PER FlatList row on the Today screen — one channel
// per group the user is in. Channel name is namespaced per `userId` AND
// `groupId` to avoid collisions across users on the same device (multiple
// signed-in profiles, future Supabase Auth multi-account support) and across
// groups within the same render tree (Pitfall 4).
//
// Lifecycle: useFocusEffect (Pitfall 11).
//
// @see 04-CONTEXT.md §D-15
// @see 04-PATTERNS.md §"useGroupTodayCardRealtime"

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useGroupTodayCardRealtime(
  groupId: string | undefined,
  userId: string | undefined,
): void {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!groupId || !userId) return;

      const channel = supabase
        .channel(`todaycard:${userId}:${groupId}`)
        .on(
          'postgres_changes' as never,
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'group_members',
            filter: `group_id=eq.${groupId}`,
          } as never,
          (payload: { new?: unknown; old?: unknown }) => {
            const newRow = payload.new as
              | { user_id?: string }
              | undefined;
            // Always: a counter mutated for SOMEONE in this group → posted-
            // today count may have moved.
            qc.invalidateQueries({ queryKey: ['todaySocialCounts', groupId] });

            // Conditionally: when the mutation is for THIS user's row, also
            // invalidate the leaderboard cache so the Today GroupCard's
            // own-row stats refresh even when the LB list isn't mounted.
            if (newRow?.user_id === userId) {
              qc.invalidateQueries({
                queryKey: ['groupLeaderboard', groupId],
              });
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [groupId, userId, qc]),
  );
}
