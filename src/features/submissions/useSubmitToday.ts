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
 * Generate an RFC4122 v4 uuid. Prefers the platform `crypto.randomUUID()` (used
 * by tests via jest.setup.ts's deterministic counter-based stub). Falls back to
 * a `crypto.getRandomValues()`-based byte construction when randomUUID is not
 * available on this runtime (Hermes in some SDK 55 builds exposes
 * getRandomValues via the react-native-get-random-values polyfill but does not
 * surface randomUUID).
 *
 * Both paths produce a true RFC4122 v4 UUID (correct version byte 0x40 +
 * variant byte 0x80) backed by cryptographic randomness — REVIEWS.md C4's
 * "never write a non-RFC4122 uuid" invariant is preserved by both.
 *
 * Throws `uuid_unavailable` ONLY if BOTH platform APIs are missing — extremely
 * unlikely given Plan 03-01's polyfill in src/lib/supabase.ts is imported
 * before any submission code runs.
 */
function newClientUuid(): string {
  const cryptoApi = (
    globalThis as unknown as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (a: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    // RFC4122 v4 layout: bits 4-7 of byte 6 = 0100, bits 6-7 of byte 8 = 10.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  throw new Error('uuid_unavailable');
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
