// PER REVIEWS.md C3 (HIGH security — Mitigation A):
// Admin-only read of pending submissions for the group.
//
// Calls the SECURITY DEFINER `get_pending_review_queue(p_group_id)` RPC added
// in Plan 03-02. The RPC validates `is_group_admin(p_group_id)` server-side
// and raises `not_admin` for non-admins — REPLACES the previous client-side
// direct table SELECT which leaked pending media to any group member who
// deep-linked /groups/[id]/review.
//
// Defense in depth:
//   - Layer A (server gate, this hook): RPC raises `not_admin` for non-admins.
//   - Layer B (client gate, Plan 03-07 review screen): screen redirects
//     non-admins to /groups/[id] BEFORE this hook even runs. So in normal
//     operation, this hook only fires for admins.
//   - Layer C (RLS, defense underneath): submissions_select_group_members
//     RLS policy still applies even though the RPC is the canonical path.
//
// Query key: ['reviewQueue', groupId]
// Server-side ordering: created_at asc, limit 50 (inside the RPC body).
//
// Pattern source: 03-PATTERNS.md §useReviewQueue (lines 962-1022).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface PendingSubmissionRow {
  id: string;
  user_id: string;
  caption: string | null;
  media_path: string;
  media_type: 'photo' | 'video';
  created_at: string;
  display_name: string | null;
  avatar_path: string | null;
  // for avatar cache-bust per WR-01 pattern (was profile_updated_at on the RPC row)
  updated_at: string | null;
}

// Mirrors the public.review_queue_row composite type from src/types/database.ts
// (composite columns are typed as nullable; we narrow as we map).
type RpcQueueRow = {
  id: string | null;
  user_id: string | null;
  caption: string | null;
  media_path: string | null;
  media_type: string | null;
  created_at: string | null;
  display_name: string | null;
  avatar_path: string | null;
  profile_updated_at: string | null;
};

export function useReviewQueue(groupId: string | undefined) {
  return useQuery({
    queryKey: ['reviewQueue', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<PendingSubmissionRow[]> => {
      const { data, error } = await supabase.rpc('get_pending_review_queue', {
        p_group_id: groupId!,
      });
      if (error) {
        // 'not_admin' surfaces here if a non-admin somehow bypasses the screen
        // gate (e.g. raw deep-link before route guard runs). Propagate so the
        // route guard / error boundary can redirect.
        throw new Error(error.message);
      }
      const rows = (data ?? []) as unknown as RpcQueueRow[];
      // Map RPC's profile_updated_at → updated_at to match PendingSubmissionRow shape.
      // The RPC source returns NOT-NULL columns for the submission fields (only the
      // optional profile fields can be null) — narrow with the `!` for the required
      // columns to align with the public PendingSubmissionRow contract.
      return rows.map((r) => ({
        id: r.id!,
        user_id: r.user_id!,
        caption: r.caption,
        media_path: r.media_path!,
        media_type: r.media_type as 'photo' | 'video',
        created_at: r.created_at!,
        display_name: r.display_name,
        avatar_path: r.avatar_path,
        updated_at: r.profile_updated_at,
      }));
    },
  });
}
