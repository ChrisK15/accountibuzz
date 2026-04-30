// Admin mutation for approve/reject. Calls review_submission RPC.
//
// Behavior:
//   - On SUCCESS: invalidates ['reviewQueue', groupId] + ['pendingReviewCount', groupId]
//   - Does NOT invalidate ['submission', groupId, 'today'] — the submitter's
//     Today screen updates via useTodaySubmissionRealtime (cross-device flow per ADM-04)
//   - On TYPED error (not_admin / not_pending / invalid_decision / etc.):
//     re-throws for the swipe screen to show the inline error toast per UI-SPEC line 898
//
// Pattern source: 03-PATTERNS.md §useReviewSubmission (lines 1130-1159).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { ReviewSubmissionInput } from './schemas';

export function useReviewSubmission(groupId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<void, Error, ReviewSubmissionInput>({
    mutationFn: async (input) => {
      const { error } = await supabase.rpc('review_submission', {
        p_submission_id: input.submissionId,
        p_decision: input.decision,
        // The RPC arg is non-nullable string in the regenerated types; pass
        // empty string for a null reason and let the server interpret accordingly.
        p_rejection_reason: input.rejectionReason ?? '',
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      if (!groupId) return;
      qc.invalidateQueries({ queryKey: ['reviewQueue', groupId] });
      qc.invalidateQueries({ queryKey: ['pendingReviewCount', groupId] });
      // Intentionally NOT invalidating ['submission', ...] — Realtime patches
      // it cross-device via useTodaySubmissionRealtime (ADM-04 + D-13).
    },
  });
}
