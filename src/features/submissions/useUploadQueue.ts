// Read of the AsyncStorage upload queue, grouped by group_id.
// Returns a Map<groupId, { sizeLabel, count }> so callers can do `queue.get(groupId)`.
//
// Cache invalidation strategy: enqueue / dequeue / flush callers in
// uploadQueueManager.ts can `queryClient.invalidateQueries(['uploadQueue'])`
// to force a re-derive. The hook itself does NOT subscribe to AsyncStorage
// changes (no native event for that); manual invalidation is the contract.
//
// Plan 03-06 wiring TODO: `startQueueManager` (Plan 03-03) needs to invalidate
// `['uploadQueue']` after enqueue/dequeue/flush events — see SUMMARY for options.
//
// Query key: ['uploadQueue']
// staleTime: 0 (always re-derive on demand).

import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { readQueue } from './uploadQueueManager';

export interface UploadQueueSummary {
  sizeLabel: string; // e.g. "2.4 MB"
  count: number;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function useUploadQueue() {
  return useQuery({
    queryKey: ['uploadQueue'],
    queryFn: async (): Promise<Map<string, UploadQueueSummary>> => {
      const entries = await readQueue();
      const byGroup = new Map<string, { totalBytes: number; count: number }>();

      for (const entry of entries) {
        // Best-effort file size lookup; if File API rejects, treat as 0.
        let bytes = 0;
        try {
          const file = new File(entry.media_local_uri);
          const meta = (file as { size?: number }).size; // SDK 55 File class exposes .size
          bytes = typeof meta === 'number' ? meta : 0;
        } catch {
          bytes = 0;
        }
        const cur = byGroup.get(entry.group_id) ?? { totalBytes: 0, count: 0 };
        byGroup.set(entry.group_id, {
          totalBytes: cur.totalBytes + bytes,
          count: cur.count + 1,
        });
      }

      const result = new Map<string, UploadQueueSummary>();
      for (const [groupId, agg] of byGroup) {
        result.set(groupId, {
          sizeLabel: formatBytes(agg.totalBytes),
          count: agg.count,
        });
      }
      return result;
    },
  });
}
