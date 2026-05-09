// Today GroupCard signal-line counts (D-13 / D-15).
//
// Returns the integer count of members in this group who have at least one
// approved submission for today's local date (computed server-side in the
// RPC body). Powers the "N/M posted" line on the Today screen's per-group
// card.
//
// Query key: ['todaySocialCounts', groupId]
// staleTime: 15s — refresh on every Today screen mount (mirrors
// usePendingReviewCount).
//
// Pattern source: src/features/submissions/usePendingReviewCount.ts (single-arg
// scalar RPC pattern). HIGH #6 strict-grant: anon callers hit a SQL grant
// gate before the function body — propagate the error so the caller can
// redirect (anon should not reach this hook in normal operation since the
// route is gated by the auth wrapper, but defense-in-depth still applies).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useGroupSocialCounts(groupId: string | undefined) {
  return useQuery({
    queryKey: ['todaySocialCounts', groupId],
    enabled: !!groupId,
    staleTime: 15_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_today_posted_count', {
        p_group_id: groupId!,
      });
      if (error) throw new Error(error.message);
      // Null coercion to 0 — the social-signal line renders "0/M" not
      // "null/M" when no member has posted today.
      return (data as number | null) ?? 0;
    },
  });
}
