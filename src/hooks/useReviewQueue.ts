/**
 * useReviewQueue.ts
 * Live subscription to pending submissions for a group. Exposes approve,
 * requestResubmission, and flag actions that call the submission service
 * and optimistically remove the item from the local list on success.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToPendingSubmissions, updateSubmissionStatus } from '@/services/firebase/submissionService'
import { type Submission } from '@/types/submission'

type UseReviewQueueResult = {
  submissions: Submission[]
  isLoading: boolean
  error: string | null
  approve: (submissionId: string) => Promise<void>
  requestResubmission: (submissionId: string, note: string) => Promise<void>
  flag: (submissionId: string, note: string) => Promise<void>
}

export function useReviewQueue(groupId: string): UseReviewQueueResult {
  const { firebaseUser } = useAuth()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToPendingSubmissions(groupId, data => {
      setSubmissions(data)
      setIsLoading(false)
    })
    return unsub
  }, [groupId])

  // Optimistically removes the item so the list updates instantly.
  function removeOptimistically(submissionId: string) {
    setSubmissions(prev => prev.filter(s => s.id !== submissionId))
  }

  const approve = useCallback(async (submissionId: string) => {
    if (!firebaseUser) return
    const snapshot = submissions
    removeOptimistically(submissionId)
    try {
      await updateSubmissionStatus(submissionId, groupId, 'approved', firebaseUser.uid)
    } catch {
      setSubmissions(snapshot)
      setError('Failed to approve submission.')
    }
  }, [firebaseUser, submissions, groupId])

  const requestResubmission = useCallback(async (submissionId: string, note: string) => {
    if (!firebaseUser) return
    const snapshot = submissions
    removeOptimistically(submissionId)
    try {
      await updateSubmissionStatus(submissionId, groupId, 'rejected', firebaseUser.uid, note)
    } catch {
      setSubmissions(snapshot)
      setError('Failed to request resubmission.')
    }
  }, [firebaseUser, submissions, groupId])

  const flag = useCallback(async (submissionId: string, note: string) => {
    if (!firebaseUser) return
    const snapshot = submissions
    removeOptimistically(submissionId)
    try {
      await updateSubmissionStatus(submissionId, groupId, 'flagged', firebaseUser.uid, note)
    } catch {
      setSubmissions(snapshot)
      setError('Failed to flag submission.')
    }
  }, [firebaseUser, submissions])

  return { submissions, isLoading, error, approve, requestResubmission, flag }
}
