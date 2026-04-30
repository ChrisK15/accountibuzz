// Mutation that orchestrates the two-phase commit + offline queue fallback.
//
// Behavior:
//   - On SUCCESS: returns submission_id; invalidates ['submission', groupId, 'today']
//   - On TYPED error (already_submitted_today / not_member / wrong_media_type / caption_too_long):
//       re-throws Error.message unchanged so the screen branches per UI-SPEC §Error state copy
//   - On NETWORK error: enqueues to AsyncStorage queue + throws Error('queued') so the screen
//       knows to dismiss (capture screen will close; QueueBadge takes over on Today)
//
// PER REVIEWS.md C4 (corruption-cascade fix):
//   The client_uuid is generated via globalThis.crypto.randomUUID() ONLY (no
//   `${Date.now()}-${Math.random()...}` fallback). If randomUUID is missing,
//   newClientUuid throws Error('uuid_unavailable') — a typed error that bypasses
//   the queue-fallback path so we never write a non-RFC4122 uuid that would
//   corrupt the queue (Zod's z.string().uuid() check would have failed and the
//   pre-fix readQueue dropped the entire queue on any malformed entry).
//
// Pattern source: 03-PATTERNS.md §useSubmitToday (lines 1029-1071).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitMedia } from './submitMedia';
import { enqueue, type QueueEntry } from './uploadQueueManager';
import type { SubmitTodayInput } from './schemas';

/**
 * Generate an RFC4122 v4 uuid via globalThis.crypto.randomUUID. Throws the typed
 * 'uuid_unavailable' error if the platform API is missing.
 *
 * Production: react-native-get-random-values (installed in Plan 03-01) polyfills
 *   crypto.getRandomValues, which crypto.randomUUID needs under the hood. The
 *   polyfill is imported as the FIRST line of src/lib/supabase.ts, so by the
 *   time this hook is called the API is available.
 * Tests: jest.setup.ts stubs crypto.randomUUID with a counter-based RFC4122 v4
 *   generator so per-call values are RFC-valid AND predictable for assertions.
 */
function newClientUuid(): string {
  const cryptoApi = (
    globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (!cryptoApi?.randomUUID) {
    throw new Error('uuid_unavailable');
  }
  return cryptoApi.randomUUID();
}

/**
 * Heuristic: did this error come from the network layer (vs. a typed RPC error)?
 * Typed errors are short alphanumeric tokens like 'already_submitted_today'.
 * Network errors usually contain words like 'network', 'fetch', 'timeout', '5xx'.
 */
function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : '';
  return /network|fetch|timeout|abort|^[5]\d\d /i.test(msg);
}

const TYPED_ERRORS = new Set([
  'not_member',
  'wrong_media_type',
  'invalid_media_type',
  'already_submitted_today',
  'caption_too_long',
  'not_authenticated',
  'uuid_unavailable',
]);

export function useSubmitToday() {
  const qc = useQueryClient();
  return useMutation<string, Error, SubmitTodayInput>({
    mutationFn: async (input) => {
      // Generate uuid OUTSIDE the try so a missing crypto.randomUUID surfaces
      // as the typed 'uuid_unavailable' error WITHOUT triggering the network
      // fallback (PER REVIEWS.md C4 — never enqueue a non-RFC4122 uuid).
      const clientUuid = newClientUuid();
      try {
        return await submitMedia({
          groupId: input.groupId,
          mediaLocalUri: input.mediaLocalUri,
          mediaType: input.mediaType,
          caption: input.caption,
          clientUuid,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        // Typed errors propagate unchanged for screen branching.
        if (TYPED_ERRORS.has(msg)) {
          throw err;
        }
        // Network / unknown → enqueue + throw 'queued' marker.
        if (isNetworkError(err) || !msg) {
          const entry: QueueEntry = {
            client_uuid: clientUuid,
            group_id: input.groupId,
            media_local_uri: input.mediaLocalUri,
            media_type: input.mediaType,
            caption: input.caption,
            created_at_iso: new Date().toISOString(),
          };
          await enqueue(entry);
          // Invalidate the queue cache so QueueBadge appears on Today.
          qc.invalidateQueries({ queryKey: ['uploadQueue'] });
          throw new Error('queued');
        }
        // Unknown shape with a non-empty message — re-throw as-is.
        throw err;
      }
    },
    onSuccess: (_submissionId, input) => {
      // Realtime is the source of truth post-mount, but invalidate immediately
      // for the optimistic case (e.g. user dismissed capture before Realtime
      // event arrives). The query key matches useTodaySubmission's key shape,
      // but onSuccess does not know today's local-date string — invalidate the
      // groupId-prefix so any date-aware key under it refetches.
      qc.invalidateQueries({ queryKey: ['submission', input.groupId, 'today'] });
    },
  });
}
