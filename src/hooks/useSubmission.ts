/**
 * useSubmission.ts
 * Manages the proof submission flow: upload media to Storage, write the
 * Firestore doc, and fall back to the offline queue when no network.
 * The submitted_at timestamp is captured FIRST — before any async work —
 * so it reflects when the user tapped submit (PROOF-04 requirement).
 */

import { useState, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import * as FileSystem from 'expo-file-system/legacy'
import { useAuth } from '@/hooks/useAuth'
import { useNetwork } from '@/context/NetworkContext'
import { uploadMedia, createSubmission } from '@/services/firebase/submissionService'
import { enqueueUpload } from '@/services/offline/uploadQueue'
import { type MediaType } from '@/types/submission'

type UseSubmissionResult = {
  isUploading: boolean
  uploadProgress: number  // 0 to 1
  error: string | null
  submit: (params: { localUri: string; mediaType: MediaType; groupId: string }) => Promise<void>
}

export function useSubmission(): UseSubmissionResult {
  const { firebaseUser } = useAuth()
  const { isOnline } = useNetwork()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async ({ localUri, mediaType, groupId }: {
    localUri: string
    mediaType: MediaType
    groupId: string
  }) => {
    if (!firebaseUser) throw new Error('Must be signed in to submit')

    // Capture timestamp immediately — this is the "initiation" time (PROOF-04).
    const submittedAt = Timestamp.now()
    const submissionId = doc_id() // pre-generate ID so Storage + Firestore stay in sync

    setIsUploading(true)
    setError(null)

    if (!isOnline) {
      // Offline path: copy file to persistent storage and queue for later.
      try {
        const ext = mediaType === 'video' ? 'mp4' : 'jpg'
        const dest = FileSystem.documentDirectory + `queued_${submissionId}.${ext}`
        await FileSystem.copyAsync({ from: localUri, to: dest })

        await enqueueUpload({
          id: submissionId,
          userId: firebaseUser.uid,
          groupId,
          localUri: dest,
          mediaType,
          submittedAt: submittedAt.toDate().toISOString(),
        })
      } catch (e) {
        setError('Failed to queue submission. Please try again.')
        throw e
      } finally {
        setIsUploading(false)
      }
      return
    }

    // Online path: upload then write Firestore doc.
    try {
      const mediaUrl = await uploadMedia(
        localUri,
        firebaseUser.uid,
        submissionId,
        mediaType,
        progress => setUploadProgress(progress)
      )

      await createSubmission({
        submissionId,
        userId: firebaseUser.uid,
        groupId,
        mediaUrl,
        mediaType,
        submittedAt,
      })
    } catch (e) {
      setError('Upload failed. Check your connection and try again.')
      throw e
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [firebaseUser, isOnline])

  return { isUploading, uploadProgress, error, submit }
}

// Generates a random Firestore-style document ID.
function doc_id(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
