/**
 * useOfflineQueue.ts
 * Drains the offline upload queue when the device comes back online.
 * Watches the NetworkContext and triggers a drain on the false→true
 * transition only (tracked via useRef to avoid re-draining on re-renders).
 */

import { useEffect, useRef, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useNetwork } from '@/context/NetworkContext'
import { useAuth } from '@/hooks/useAuth'
import { dequeueUpload } from '@/services/offline/uploadQueue'
import { uploadMedia, createSubmission } from '@/services/firebase/submissionService'

export function useOfflineQueue(): void {
  const { isOnline } = useNetwork()
  const { firebaseUser } = useAuth()
  const prevOnlineRef = useRef(isOnline)
  const isDrainingRef = useRef(false)

  const drainQueue = useCallback(async () => {
    if (!firebaseUser || isDrainingRef.current) return
    isDrainingRef.current = true

    try {
      let item = await dequeueUpload()
      while (item) {
        try {
          const mediaUrl = await uploadMedia(item.localUri, item.userId, item.id, item.mediaType)
          await createSubmission({
            submissionId: item.id,
            userId: item.userId,
            groupId: item.groupId,
            mediaUrl,
            mediaType: item.mediaType,
            // Reconstruct Timestamp from the ISO string we stored when queuing.
            submittedAt: Timestamp.fromDate(new Date(item.submittedAt)),
          })
        } catch {
          // If one item fails, stop draining — don't lose the item.
          // It stays dequeued; a retry mechanism can be added in a future phase.
          break
        }
        item = await dequeueUpload()
      }
    } finally {
      isDrainingRef.current = false
    }
  }, [firebaseUser])

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current
    const isNowOnline = isOnline

    // Only drain on the false → true transition.
    if (wasOffline && isNowOnline) {
      drainQueue()
    }

    prevOnlineRef.current = isOnline
  }, [isOnline, drainQueue])
}
