// Per-group leaderboard Realtime patcher (LB-02 / D-20).
//
// Subscribes to postgres_changes UPDATE events on group_members filtered
// server-side by `group_id=eq.{groupId}`. On each event, the hook patches the
// matching row in the `['groupLeaderboard', groupId]` cache (single-row
// update) and re-sorts by the same triple-key the server uses
// (`points DESC, current_streak DESC, joined_at ASC` — MEDIUM tiebreaker
// fix RESOLVED via REVIEWS replan 2026-05-08).
//
// Lifecycle: useFocusEffect (NOT useEffect) — Pitfall 11. Tab navigation does
// not unmount the screen, so a useEffect cleanup would leak the channel
// forever.
//
// Server-side filter is the single-column equality `group_id=eq.{groupId}`
// (Realtime supports only single-column equality filters). RLS on
// group_members provides the cross-group disclosure mitigation (T-04-07);
// the client-side does not need to re-narrow.
//
// Pattern source: src/features/submissions/useTodaySubmissionRealtime.ts
// (verbatim shape lines 35-92).
//
// @see 04-CONTEXT.md §D-20
// @see 04-PATTERNS.md §"useGroupLeaderboardRealtime"

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { LeaderboardRow } from './useGroupLeaderboard';

export function useGroupLeaderboardRealtime(groupId: string | undefined): void {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;

      const channel = supabase
        .channel(`group-lb:${groupId}`)
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
              | {
                  user_id?: string;
                  points?: number;
                  current_streak?: number;
                  longest_streak?: number;
                  last_rolled_date?: string | null;
                }
              | undefined;
            if (!newRow || !newRow.user_id) return;

            qc.setQueryData<LeaderboardRow[] | undefined>(
              ['groupLeaderboard', groupId],
              (prev) => {
                if (!prev) return prev;
                const updated = prev.map((r) =>
                  r.user_id === newRow.user_id
                    ? {
                        ...r,
                        points: newRow.points ?? r.points,
                        current_streak:
                          newRow.current_streak ?? r.current_streak,
                        longest_streak:
                          newRow.longest_streak ?? r.longest_streak,
                        last_rolled_date:
                          newRow.last_rolled_date ?? r.last_rolled_date,
                      }
                    : r,
                );
                // MEDIUM tiebreaker (RESOLVED via REVIEWS replan 2026-05-08):
                // client-side resort matches the server's ORDER BY exactly so
                // the LB list never temporarily shows two members in a swap
                // order that wouldn't survive a refetch.
                return updated.slice().sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points;
                  if (b.current_streak !== a.current_streak) {
                    return b.current_streak - a.current_streak;
                  }
                  return (
                    new Date(a.joined_at).getTime() -
                    new Date(b.joined_at).getTime()
                  );
                });
              },
            );
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [groupId, qc]),
  );
}
