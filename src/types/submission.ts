/**
 * submission.ts
 * TypeScript types for proof submissions and the offline upload queue.
 */

import { Timestamp } from 'firebase/firestore'

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'flagged'
export type MediaType = 'photo' | 'video'

// Stored at: submissions/{submissionId} (top-level collection for easy querying)
export type Submission = {
  id: string
  userId: string
  groupId: string
  displayName: string
  mediaUrl: string
  mediaType: MediaType
  submittedAt: Timestamp // captured at submit() call time, before upload
  status: SubmissionStatus
  adminNote?: string    // optional feedback from reviewer (Phase 7)
  reviewedBy?: string
  reviewedAt?: Timestamp
}

// One item in the offline upload queue stored in AsyncStorage.
export type UploadQueueItem = {
  id: string           // pre-generated submission ID
  userId: string
  groupId: string
  localUri: string     // copied to documentDirectory — safe from cache GC
  mediaType: MediaType
  submittedAt: string  // ISO string (Timestamp can't be serialized to JSON)
}
