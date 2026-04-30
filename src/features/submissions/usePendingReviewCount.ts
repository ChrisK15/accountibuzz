// Admin-only count for the "Pending review (N)" badge on group-detail.
// Returns 0 for non-admins (server-side gate per D-17 + Plan 03-02 RPC body).
//
// Query key: ['pendingReviewCount', groupId]
// staleTime: 15s — refresh on every detail-screen mount.
//
// Pattern source: 03-PATTERNS.md §usePendingReviewCount (lines 933-957).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function usePendingReviewCount(groupId: string | undefined) {
  return useQuery({
    queryKey: ['pendingReviewCount', groupId],
    enabled: !!groupId,
    staleTime: 15_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_pending_review_count', {
        p_group_id: groupId!,
      });
      if (error) throw new Error(error.message);
      return (data as number | null) ?? 0;
    },
  });
}
