/**
 * src/features/submissions/uploadQueueManager.ts
 *
 * AsyncStorage-backed offline upload queue (D-07 + D-08 + RESEARCH §Pattern 2).
 *
 * Schema: single key 'accountibuzz.uploadQueue' holds a JSON array of QueueEntry.
 * Single-key + JSON array is the simplest atomic primitive AsyncStorage offers.
 *
 * Flush triggers (wired by startQueueManager from app/_layout.tsx in Plan 03-06):
 *   - AppState 'active' transition
 *   - NetInfo isConnected + isInternetReachable transition
 *   - Manual flushQueue(session) call (e.g. from QueueBadge "Retry now")
 *
 * Drop entries on (per D-08):
 *   - already_submitted_today (the day already has a row)
 *   - not_member (user removed from group while queued)
 *   - wrong_media_type (group's submission_type changed since enqueue)
 * Retain entries on:
 *   - network / 5xx errors (retry on next trigger)
 *   - JWT 401 (supabase-js refreshes; next retry uses fresh token)
 *
 * PER REVIEWS.md C4: per-entry validation in readQueue. Drops only the malformed
 * entries; preserves valid ones. Previous "drop entire queue on any parse failure"
 * behavior caused total data-loss whenever one bad entry slipped in.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { z } from 'zod';
import type { Session } from '@supabase/supabase-js';
import { submitMedia } from './submitMedia';

export const QUEUE_KEY = 'accountibuzz.uploadQueue';

export const queueEntrySchema = z.object({
  client_uuid: z.string().uuid(),
  group_id: z.string().uuid(),
  media_local_uri: z.string().min(1),
  media_type: z.enum(['photo', 'video']),
  caption: z.string().max(140).nullable(),
  created_at_iso: z.string().datetime(),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

/** Errors that mean the entry can never succeed — drop it. Per D-08. */
const DROP_ON_ERROR = new Set([
  'already_submitted_today',
  'not_member',
  'wrong_media_type',
]);

/** Re-entrancy guard so concurrent triggers don't double-flush. */
let flushing = false;

export async function readQueue(): Promise<QueueEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    // The stored value is not even valid JSON — full reset.
    console.warn('[uploadQueue] storage value is not valid JSON — resetting');
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
  if (!Array.isArray(parsedJson)) {
    console.warn('[uploadQueue] storage value is not an array — resetting');
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }

  // PER REVIEWS.md C4: per-entry validation. Drop only the malformed entries;
  // preserve the valid ones. Previous "drop entire queue on any parse failure"
  // behavior caused total data-loss whenever one bad entry slipped in (e.g. via
  // the original UUID fallback bug).
  const valid: QueueEntry[] = [];
  let dropped = 0;
  for (const candidate of parsedJson) {
    const r = queueEntrySchema.safeParse(candidate);
    if (r.success) {
      valid.push(r.data);
    } else {
      dropped += 1;
    }
  }
  if (dropped > 0) {
    console.warn(
      `[uploadQueue] dropping ${dropped} malformed entries; ${valid.length} preserved`,
    );
    // Persist the cleaned queue so we don't reapply the per-entry parse cost on every read.
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(valid));
  }
  return valid;
}

export async function enqueue(entry: QueueEntry): Promise<void> {
  const cur = await readQueue();
  // De-dupe by client_uuid (a prior enqueue with the same uuid is a no-op).
  if (cur.some((e) => e.client_uuid === entry.client_uuid)) return;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...cur, entry]));
}

export async function dequeue(client_uuid: string): Promise<void> {
  const cur = await readQueue();
  const next = cur.filter((e) => e.client_uuid !== client_uuid);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
}

/**
 * Attempts to upload every queued entry in order. Stops on the first non-typed
 * error (network) to avoid hammering the server when offline.
 */
export async function flushQueue(session: Session | null): Promise<void> {
  if (flushing || !session) return;
  flushing = true;
  try {
    const entries = await readQueue();
    for (const entry of entries) {
      try {
        await submitMedia({
          groupId: entry.group_id,
          mediaLocalUri: entry.media_local_uri,
          mediaType: entry.media_type,
          caption: entry.caption,
          clientUuid: entry.client_uuid,
        });
        // Success → drop entry from queue.
        await dequeue(entry.client_uuid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (DROP_ON_ERROR.has(msg)) {
          // Terminal typed error → drop entry (the user missed the day OR the
          // group changed). Continue to next entry — others might still succeed.
          await dequeue(entry.client_uuid);
          continue;
        }
        // Network / 5xx / JWT / unknown → keep entry; stop iteration so we don't
        // hammer a degraded backend with the rest of the queue.
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

/**
 * Wires AppState + NetInfo flush triggers. Call ONCE from app/_layout.tsx
 * (Plan 03-06). Returns an unsubscribe function for cleanup on signout.
 */
export function startQueueManager(
  getSession: () => Session | null,
): () => void {
  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') {
      flushQueue(getSession()).catch((e) =>
        console.warn('[uploadQueue] flush error', e),
      );
    }
  };
  const onNetwork = (state: {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }) => {
    if (state.isConnected && state.isInternetReachable) {
      flushQueue(getSession()).catch((e) =>
        console.warn('[uploadQueue] flush error', e),
      );
    }
  };

  const appStateSub = AppState.addEventListener('change', onAppState);
  const netInfoUnsubscribe = NetInfo.addEventListener(onNetwork);

  return () => {
    appStateSub.remove();
    netInfoUnsubscribe();
  };
}
