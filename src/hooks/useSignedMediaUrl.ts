// src/hooks/useSignedMediaUrl.ts
//
// HIGH #11 from REVIEWS replan 2026-05-08:
// FeedItem (and 04-05 MediaViewer) need to mock the signed-URL fetch in tests.
// When this hook lives inline inside FeedItem.tsx, jest.spyOn cannot reach it.
// This file is the canonical source — FeedItem and MediaViewer import from here.
// SwipeCard (P3) keeps its inline copy for now (P4 is not touching SwipeCard);
// a future polish task may unify SwipeCard onto this shared hook.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Resolve a signed URL for a private 'submissions' bucket path.
 * Returns idle state when path is undefined.
 *
 * staleTime is 50_000 ms — leaves a 10s margin before the 60s TTL expires
 * so consumers refetch in time to avoid 403s on the rendered Image/Video.
 *
 * queryKey includes the bucket name ('submissions') so future calls for
 * other buckets don't collide on the cache.
 */
export function useSignedMediaUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['signedUrl', 'submissions', path],
    enabled: !!path,
    staleTime: 50_000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('submissions')
        .createSignedUrl(path!, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
