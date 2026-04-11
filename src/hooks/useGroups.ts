/**
 * useGroups.ts
 * Returns the list of all groups the current user belongs to, with live
 * updates. Any screen that shows a group list uses this hook.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToUserGroups } from '@/services/firebase/groupService'
import { type Group } from '@/types/group'

type UseGroupsResult = {
  groups: Group[]
  isLoading: boolean
  error: string | null
}

export function useGroups(): UseGroupsResult {
  const { firebaseUser } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) {
      setGroups([])
      setIsLoading(false)
      return
    }

    // Subscribe returns an unsubscribe function. We return it from useEffect
    // so React calls it automatically when the component unmounts — this stops
    // the Firestore listener and prevents memory leaks.
    const unsubscribe = subscribeToUserGroups(
      firebaseUser.uid,
      groups => {
        setGroups(groups)
        setIsLoading(false)
      },
      err => {
        setError(err.message)
        setIsLoading(false)
      }
    )

    return unsubscribe
  }, [firebaseUser])

  return { groups, isLoading, error }
}
