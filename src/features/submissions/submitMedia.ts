/**
 * src/features/submissions/submitMedia.ts
 *
 * Two-phase commit pipeline (D-06 + D-19):
 *   1. Compress photo (skip for video). Read into ArrayBuffer via SDK 55 File class.
 *   2. supabase.storage.upload(path, buf, { upsert: false }) — 409 'already exists'
 *      is a benign idempotent retry (same client_uuid → same path → object exists
 *      from a prior attempt → fall through to phase 2).
 *   3. supabase.rpc('submit_today', { ... }) — server derives local_date.
 *
 * Used by useSubmitToday (Plan 03-05) wrapped in TanStack Query mutation,
 * AND directly by uploadQueueManager.flushQueue for queue retries.
 *
 * Source: 03-RESEARCH.md §Pattern 1 + §Code Examples §3 (lines 870-963).
 */

import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../lib/supabase';

export type SubmitMediaInput = {
  groupId: string;
  mediaLocalUri: string;
  mediaType: 'photo' | 'video';
  caption: string | null;
  /** Optional pre-supplied UUID (for queue retries — same uuid → same storage path → idempotent retry). */
  clientUuid?: string;
};

/**
 * Returns a UUID string. Prefers the platform `crypto.randomUUID()` (Hermes
 * exposes it once `react-native-get-random-values` is loaded — see
 * `app/_layout.tsx` first-import in Plan 03-06; jest.setup.ts polyfills a
 * deterministic counter-based stub).
 *
 * Falls back to a Math.random()-based RFC 4122 v4 only if the crypto API is
 * entirely missing — extremely unlikely in production OR tests.
 */
function randomUuid(): string {
  const cryptoApi = (
    globalThis as unknown as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (a: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // RFC 4122 v4 layout
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Returns the new submission_id on success.
 *
 * Throws Error with one of these typed messages on failure:
 *   - 'not_authenticated' | 'not_member' | 'wrong_media_type' | 'invalid_media_type'
 *   - 'caption_too_long' | 'already_submitted_today'
 *   - any storage upload error (network / 5xx) — the caller (queue manager) decides whether to enqueue
 */
export async function submitMedia(input: SubmitMediaInput): Promise<string> {
  // Resolve the authenticated user — needed for the storage path's user_id segment.
  const { data: userResult, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResult.user) {
    throw new Error('not_authenticated');
  }
  const user = userResult.user;

  // Phase 0: compress (photo only). Video is recorded at 720p/10s by capture screen.
  let uploadUri = input.mediaLocalUri;
  let contentType: string;
  let ext: string;
  if (input.mediaType === 'photo') {
    const compressed = await ImageManipulator.manipulateAsync(
      input.mediaLocalUri,
      [{ resize: { width: 1080 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    uploadUri = compressed.uri;
    contentType = 'image/jpeg';
    ext = 'jpg';
  } else {
    contentType = 'video/mp4';
    ext = 'mp4';
  }

  // Phase 1 prep: read media into ArrayBuffer using the SDK 55 modern File API.
  // This avoids the base64 round-trip used by the legacy avatar pipeline (RESEARCH finding 3).
  const file = new File(uploadUri);
  const buf = await file.arrayBuffer();

  // Storage path per D-19: {group_id}/{user_id}/{client_uuid}.{ext}
  // The 0001 storage RLS only checks the first two segments — the third is opaque.
  const clientUuid = input.clientUuid ?? randomUuid();
  const path = `${input.groupId}/${user.id}/${clientUuid}.${ext}`;

  // Phase 1: upload to storage. upsert:false → 409 on retry of the same path.
  // We treat 409 as "object already exists from a prior succeeded upload, proceed to phase 2."
  const { error: upErr } = await supabase.storage.from('submissions').upload(path, buf, { contentType, upsert: false });

  if (upErr) {
    // The supabase-js storage error shape varies; check both message and statusCode.
    const msg = upErr.message ?? '';
    const isAlreadyExists =
      msg.toLowerCase().includes('already exists') ||
      msg.toLowerCase().includes('duplicate') ||
      (upErr as { statusCode?: string }).statusCode === '409';
    if (!isAlreadyExists) {
      // Network / 5xx / other → re-throw so the caller (queue manager / mutation
      // hook) can decide whether to enqueue.
      throw upErr;
    }
    // Else: object exists from a prior attempt; fall through to phase 2.
  }

  // Phase 2: RPC for the row insert. Server derives local_date.
  const { data, error: rpcErr } = await supabase.rpc('submit_today', {
    p_group_id: input.groupId,
    p_media_path: path,
    p_media_type: input.mediaType,
    p_caption: input.caption,
  });

  if (rpcErr) {
    // Typed errors propagate as Error.message for the screen to branch on
    // (Shared Pattern 5; UI-SPEC §Error state copy).
    throw new Error(rpcErr.message);
  }

  // data is the new submission_id (uuid serialized as string by PostgREST).
  if (typeof data !== 'string') {
    throw new Error('rpc_returned_unexpected_shape');
  }
  return data;
}
