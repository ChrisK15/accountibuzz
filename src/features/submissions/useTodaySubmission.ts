// Read the current user's submission row for the given group on today's local date.
// `null` is the expected "not yet submitted" state — NOT an error (uses .maybeSingle()).
//
// Query key: ['submission', groupId, todayLocalDate]
//   PER REVIEWS.md C1 (HIGH): include the local-date string in the key (NOT the
//   literal 'today') so the cache rotates automatically when local-date changes
//   (app stays open across midnight; clock skew). The Realtime handler in
//   useTodaySubmissionRealtime patches this SAME date-aware key.
//
// Pattern source: 03-PATTERNS.md §useTodaySubmission (lines 884-927).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface TodaySubmissionRow {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  caption: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  local_date: string;
  media_path: string;
  media_type: 'photo' | 'video';
}

export function useTodaySubmission(
  groupId: string | undefined,
  todayLocalDate: string | undefined,
) {
  return useQuery({
    queryKey: ['submission', groupId, todayLocalDate],
    enabled: !!groupId && !!todayLocalDate,
    queryFn: async (): Promise<TodaySubmissionRow | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('submissions')
        .select(
          'id, status, caption, rejection_reason, reviewed_at, created_at, local_date, media_path, media_type',
        )
        .eq('group_id', groupId!)
        .eq('user_id', user.id)
        .eq('local_date', todayLocalDate!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as TodaySubmissionRow | null) ?? null;
    },
  });
}
