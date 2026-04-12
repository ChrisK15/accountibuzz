/**
 * submissionService.ts
 * Handles uploading proof media to Firebase Storage and writing submission
 * documents to Firestore. Also exposes query helpers used by the review queue.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import * as FileSystem from 'expo-file-system/legacy'
import { db } from './config'
import { supabase } from '@/services/supabase/config'
import { type Submission, type SubmissionStatus, type MediaType } from '@/types/submission'

/**
 * uploadMedia
 * Uploads a local file URI to Supabase Storage with progress callbacks.
 * Returns the public download URL when complete.
 *
 * Storage path: submissions/{userId}/{submissionId}
 */
export async function uploadMedia(
  localUri: string,
  userId: string,
  submissionId: string,
  mediaType: MediaType,
  onProgress?: (progress: number) => void
): Promise<string> {
  const ext = mediaType === 'video' ? 'mp4' : 'jpg'
  const path = `${userId}/${submissionId}.${ext}`

  const SUPABASE_URL = 'https://kxaiyspsvtvjxyndqxwk.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YWl5c3BzdnR2anh5bmRxeHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjU4NjMsImV4cCI6MjA5MjQwMTg2M30.OKIsWqsifxi6vpGfVq_YPG3dIUljVFriM5uuleAwR2A'

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/submissions/${path}`

  const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    },
  })

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed with status ${result.status}: ${result.body}`)
  }

  onProgress?.(1)

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/submissions/${path}`
  return publicUrl
}

/**
 * createSubmission
 * Writes the submission document to Firestore after the upload completes.
 * submittedAt is passed in (captured before upload) so the timestamp reflects
 * when the user tapped submit, not when the upload finished.
 */
export async function createSubmission(params: {
  submissionId: string
  userId: string
  groupId: string
  mediaUrl: string
  mediaType: MediaType
  submittedAt: Timestamp
}): Promise<void> {
  const { submissionId, groupId, userId } = params
  const userSnap = await getDoc(doc(db, 'users', userId))
  const displayName: string = userSnap.data()?.displayName ?? 'Unknown'
  await setDoc(doc(db, 'groups', groupId, 'submissions', submissionId), {
    userId,
    groupId,
    displayName,
    mediaUrl: params.mediaUrl,
    mediaType: params.mediaType,
    submittedAt: params.submittedAt,
    status: 'pending',
  })
}

/**
 * updateSubmissionStatus
 * Called by admins to approve, reject, or flag a submission.
 * Optionally stores a note (used for rejection feedback).
 */
export async function updateSubmissionStatus(
  submissionId: string,
  groupId: string,
  status: SubmissionStatus,
  reviewedBy: string,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'submissions', submissionId), {
    status,
    reviewedBy,
    reviewedAt: Timestamp.now(),
    ...(note ? { adminNote: note } : {}),
  })
}

/**
 * subscribeToPendingSubmissions
 * Live listener for all pending submissions in a group. Used by the admin
 * review queue.
 */
export function subscribeToPendingSubmissions(
  groupId: string,
  onData: (submissions: Submission[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'groups', groupId, 'submissions'),
    where('status', '==', 'pending'),
    orderBy('submittedAt', 'asc')
  )
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Submission))
  })
}
