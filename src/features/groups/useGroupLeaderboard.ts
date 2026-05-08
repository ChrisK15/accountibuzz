// Per-group leaderboard read (LB-01 / D-04).
//
// Calls the SECURITY DEFINER `get_group_leaderboard(p_group_id)` RPC added in
// Plan 04-02. The RPC returns rows already ordered by
// `points DESC, current_streak DESC, joined_at ASC` — the joined_at ASC
// tiebreaker (MEDIUM tiebreaker fix RESOLVED via REVIEWS replan 2026-05-08)
// guarantees deterministic ranking when two members are tied on points and
// current_streak. The hook does NOT re-sort client-side.
//
// Query key: ['groupLeaderboard', groupId] (D-04 canonical).
//
// Pattern source: src/features/submissions/useReviewQueue.ts (RPC + composite
// nullable narrowing).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  // WR-01 cache-bust: include profiles.updated_at so leaderboard avatars can
  // bust the expo-image URL cache after avatar uploads.
  updated_at: string | null;
  points: number;
  current_streak: number;
  longest_streak: number;
  // Nullable in real-world data — group_members.last_rolled_date is NULL until
  // the first approval lands; the regenerated database.ts narrows this to
  // string but the migration column is nullable.
  last_rolled_date: string | null;
  // MEDIUM tiebreaker (RESOLVED via REVIEWS replan 2026-05-08): joined_at ASC
  // is the deterministic third sort key — kept on the row so the Realtime
  // patcher can re-sort client-side after a single-row UPDATE arrives.
  joined_at: string;
}

// Mirrors the regenerated public.get_group_leaderboard return row from
// src/types/database.ts (composite columns are typed loosely — supabase-js
// returns nullable fields on composite RPC sets even when the SQL declares
// them NOT NULL).
type RpcLeaderboardRow = {
  user_id: string | null;
  display_name: string | null;
  avatar_path: string | null;
  updated_at: string | null;
  points: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  last_rolled_date: string | null;
  joined_at: string | null;
};

export function useGroupLeaderboard(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groupLeaderboard', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('get_group_leaderboard', {
        p_group_id: groupId!,
      });
      if (error) {
        // Typed errors from the RPC body (e.g. 'not_member' P0001) surface as
        // PostgrestError.message; rethrow so TanStack exposes via result.error.
        throw new Error(error.message);
      }
      const rows = (data ?? []) as unknown as RpcLeaderboardRow[];
      // Server-side sort is canonical (group_members_leaderboard_idx +
      // joined_at ASC tiebreaker); the hook does NOT re-sort. Map nullable
      // composite columns to the typed `LeaderboardRow` contract.
      return rows.map((r) => ({
        user_id: r.user_id!,
        display_name: r.display_name,
        avatar_path: r.avatar_path,
        updated_at: r.updated_at,
        points: r.points ?? 0,
        current_streak: r.current_streak ?? 0,
        longest_streak: r.longest_streak ?? 0,
        last_rolled_date: r.last_rolled_date,
        joined_at: r.joined_at!,
      }));
    },
  });
}
