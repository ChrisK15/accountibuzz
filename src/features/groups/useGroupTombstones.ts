// Today-pending + Yesterday-missed tombstones (FEED-02 + FEED-03 / D-05 + D-07).
//
// Two independent useQuery calls inside one exported hook so each cache key
// invalidates independently per CONTEXT D-07: today's-not-yet changes when a
// member submits; yesterday's-misses changes only at the next midnight
// rollover. Independent keys keep the two surfaces from invalidating each
// other unnecessarily.
//
// Query keys:
//   ['groupTombstones', groupId, 'today']     → get_pending_today RPC
//   ['groupTombstones', groupId, 'yesterday'] → get_missed_yesterday RPC
//
// Locked return shape (MEDIUM #3 — RESOLVED via REVIEWS replan 2026-05-08):
//   { pendingToday, missedYesterday, isPending, error }
//
// Pattern source: src/features/submissions/usePendingReviewCount.ts (single-arg
// RPC pattern) + src/features/submissions/useReviewQueue.ts (composite-row
// nullable narrowing).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface TombstoneRow {
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  // WR-01 cache-bust: include profiles.updated_at so tombstone avatars can
  // bust expo-image's URL cache after avatar uploads.
  updated_at: string | null;
}

// Mirrors the regenerated public.get_pending_today / get_missed_yesterday
// return rows from src/types/database.ts (composite columns are typed loosely
// — supabase-js returns nullable fields on composite RPC sets even when the
// SQL declares them NOT NULL).
type RpcTombstoneRow = {
  user_id: string | null;
  display_name: string | null;
  avatar_path: string | null;
  updated_at: string | null;
};

function mapRows(data: unknown): TombstoneRow[] {
  const rows = (data ?? []) as unknown as RpcTombstoneRow[];
  return rows.map((r) => ({
    user_id: r.user_id!,
    display_name: r.display_name,
    avatar_path: r.avatar_path,
    updated_at: r.updated_at,
  }));
}

export function useGroupTombstones(groupId: string | undefined): {
  pendingToday: TombstoneRow[];
  missedYesterday: TombstoneRow[];
  isPending: boolean;
  error: Error | null;
} {
  const todayQuery = useQuery({
    queryKey: ['groupTombstones', groupId, 'today'],
    enabled: !!groupId,
    queryFn: async (): Promise<TombstoneRow[]> => {
      const { data, error } = await supabase.rpc('get_pending_today', {
        p_group_id: groupId!,
      });
      if (error) throw new Error(error.message);
      return mapRows(data);
    },
  });

  const yesterdayQuery = useQuery({
    queryKey: ['groupTombstones', groupId, 'yesterday'],
    enabled: !!groupId,
    queryFn: async (): Promise<TombstoneRow[]> => {
      const { data, error } = await supabase.rpc('get_missed_yesterday', {
        p_group_id: groupId!,
      });
      if (error) throw new Error(error.message);
      return mapRows(data);
    },
  });

  return {
    // Always an array (never undefined) — consumers iterate without null
    // checks (per MEDIUM #3 locked shape).
    pendingToday: todayQuery.data ?? [],
    missedYesterday: yesterdayQuery.data ?? [],
    isPending: todayQuery.isPending || yesterdayQuery.isPending,
    error:
      (todayQuery.error as Error | null) ??
      (yesterdayQuery.error as Error | null) ??
      null,
  };
}
