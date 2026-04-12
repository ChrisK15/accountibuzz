/**
 * uploadQueue.ts
 * Persists pending uploads in AsyncStorage so they survive app restarts.
 * Items are stored as a JSON array under QUEUE_KEY. Each item has a local
 * file URI (copied to documentDirectory — safe from cache eviction) and the
 * metadata needed to reconstruct the Firestore submission.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { type UploadQueueItem } from '@/types/submission'

const QUEUE_KEY = '@accountibuzz/upload_queue'

// Load the full queue from AsyncStorage. Returns [] if nothing is stored.
async function loadQueue(): Promise<UploadQueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as UploadQueueItem[]
  } catch {
    return []
  }
}

// Persist the queue back to AsyncStorage.
async function saveQueue(queue: UploadQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/**
 * enqueueUpload
 * Adds a new item to the end of the queue.
 */
export async function enqueueUpload(item: UploadQueueItem): Promise<void> {
  const queue = await loadQueue()
  queue.push(item)
  await saveQueue(queue)
}

/**
 * dequeueUpload
 * Removes and returns the first item in the queue (FIFO).
 * Returns null if the queue is empty.
 */
export async function dequeueUpload(): Promise<UploadQueueItem | null> {
  const queue = await loadQueue()
  if (queue.length === 0) return null
  const [first, ...rest] = queue
  await saveQueue(rest)
  return first
}

/**
 * getAllQueued
 * Returns all items currently in the queue without removing them.
 * Used to display a "pending uploads" count in the UI.
 */
export async function getAllQueued(): Promise<UploadQueueItem[]> {
  return loadQueue()
}

/**
 * clearQueue
 * Empties the queue. Called after a successful full drain.
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY)
}
