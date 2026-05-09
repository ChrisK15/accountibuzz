// Today's-approved feed for a group (FEED-01 / D-21).
//
// Direct PostgREST select on `submissions` with an embedded profile join.
// Only `status = 'approved'` AND `local_date = today` rows are returned;
// ordering is `created_at DESC` (newest-first per UI-SPEC).
//
// Query key: ['groupFeed', groupId, today] — date-aware so a midnight
// rollover swaps to a fresh cache rather than mutating yesterday's feed.
//
// Pattern source: src/features/groups/useGroupMembers.ts (PostgREST embedded
// join + nullable-narrowing flat-shape mapping).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface FeedRow {
  id: string;
  user_id: string;
  caption: string | null;
  media_path: string;
  media_type: 'photo' | 'video';
  created_at: string;
  display_name: string | null;
  avatar_path: string | null;
  // WR-01 cache-bust: include profiles.updated_at so feed avatars can bust
  // expo-image's URL cache after avatar uploads.
  updated_at: string | null;
}

export function useGroupFeed(
  groupId: string | undefined,
  today: string | undefined,
) {
  return useQuery({
    queryKey: ['groupFeed', groupId, today],
    enabled: !!groupId && !!today,
    queryFn: async (): Promise<FeedRow[]> => {
      const { data, error } = await supabase
        .from('submissions')
        .select(
          // Disambiguate FK: submissions has two FKs to profiles
          // (user_id + reviewed_by). Without the explicit !submissions_user_id_fkey
          // hint, PostgREST returns PGRST201 (ambiguous embed) and the query fails
          // silently, surfacing as an empty feed on screen. CK-04 inline fix
          // 2026-05-09 during Phase 4 UAT.
          'id, user_id, caption, media_path, media_type, created_at, profiles!submissions_user_id_fkey(display_name, avatar_path, updated_at)',
        )
        .eq('group_id', groupId!)
        .eq('local_date', today!)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        user_id: string;
        caption: string | null;
        media_path: string;
        media_type: 'photo' | 'video';
        created_at: string;
        profiles:
          | {
              display_name: string | null;
              avatar_path: string | null;
              updated_at: string | null;
            }
          | null;
      }>;
      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        caption: r.caption,
        media_path: r.media_path,
        media_type: r.media_type,
        created_at: r.created_at,
        display_name: r.profiles?.display_name ?? null,
        avatar_path: r.profiles?.avatar_path ?? null,
        updated_at: r.profiles?.updated_at ?? null,
      }));
    },
  });
}
