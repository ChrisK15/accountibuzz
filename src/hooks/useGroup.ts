/**
 * useGroup.ts
 * Returns a single group and its member list, plus actions the current user
 * can take (create, join). Used by GroupDetailScreen and any screen that needs
 * to know the user's role within a specific group.
 */

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToGroup, createGroup, getGroupByInviteCode, updateGroup } from '@/services/firebase/groupService'
import { subscribeToMembers, joinGroup, getMember, updateMemberRole, updateMemberStatus } from '@/services/firebase/membershipService'
import { type Group, type CreateGroupData } from '@/types/group'
import { type GroupMember, type MemberRole, type MemberStatus } from '@/types/membership'

type UseGroupResult = {
  group: Group | null
  members: GroupMember[]
  currentMember: GroupMember | null
  isAdminOrCoAdmin: boolean
  isLoading: boolean
  error: string | null
  handleCreateGroup: (data: CreateGroupData) => Promise<string>
  handleJoinByCode: (code: string) => Promise<void>
  handleUpdateGroup: (data: Partial<Pick<Group, 'challengeTitle' | 'challengeDescription' | 'dailyDeadline' | 'mode'>>) => Promise<void>
  handleUpdateMemberRole: (targetUserId: string, role: MemberRole) => Promise<void>
  handleUpdateMemberStatus: (targetUserId: string, status: MemberStatus) => Promise<void>
}

export function useGroup(groupId?: string): UseGroupResult {
  const { firebaseUser } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to the group doc and its member list when groupId is provided.
  useEffect(() => {
    if (!groupId) {
      setIsLoading(false)
      return
    }

    const unsubGroup = subscribeToGroup(groupId, data => {
      setGroup(data)
      setIsLoading(false)
    })

    const unsubMembers = subscribeToMembers(groupId, data => {
      setMembers(data)
    })

    // Return a cleanup function that stops both listeners at once.
    return () => {
      unsubGroup()
      unsubMembers()
    }
  }, [groupId])

  // Derive the current user's member doc and role from the members list.
  // This updates automatically whenever the members subscription fires.
  const currentMember = members.find(m => m.userId === firebaseUser?.uid) ?? null
  const isAdminOrCoAdmin =
    currentMember?.role === 'admin' || currentMember?.role === 'co_admin'

  /**
   * handleCreateGroup
   * Creates a new group and returns its ID so the caller can navigate to it.
   */
  const handleCreateGroup = useCallback(
    async (data: CreateGroupData): Promise<string> => {
      if (!firebaseUser) throw new Error('Must be signed in to create a group')
      try {
        return await createGroup(firebaseUser.uid, data)
      } catch (e) {
        console.error('[createGroup] failed:', e)
        setError('Failed to create group. Please try again.')
        throw e
      }
    },
    [firebaseUser]
  )

  /**
   * handleJoinByCode
   * Looks up a group by invite code and adds the current user as a member.
   */
  const handleJoinByCode = useCallback(
    async (code: string): Promise<void> => {
      if (!firebaseUser) throw new Error('Must be signed in to join a group')
      try {
        const target = await getGroupByInviteCode(code.toUpperCase())
        if (!target) {
          setError('Invalid invite code. Check the link and try again.')
          return
        }
        await joinGroup(firebaseUser.uid, target.id)
      } catch (e) {
        setError('Failed to join group. Please try again.')
        throw e
      }
    },
    [firebaseUser]
  )

  const handleUpdateGroup = useCallback(
    async (data: Partial<Pick<Group, 'challengeTitle' | 'challengeDescription' | 'dailyDeadline' | 'mode'>>): Promise<void> => {
      if (!groupId) throw new Error('No groupId provided')
      try {
        await updateGroup(groupId, data)
      } catch (e) {
        setError('Failed to update group. Please try again.')
        throw e
      }
    },
    [groupId]
  )

  const handleUpdateMemberRole = useCallback(
    async (targetUserId: string, role: MemberRole): Promise<void> => {
      if (!groupId) throw new Error('No groupId provided')
      await updateMemberRole(targetUserId, groupId, role)
    },
    [groupId]
  )

  const handleUpdateMemberStatus = useCallback(
    async (targetUserId: string, status: MemberStatus): Promise<void> => {
      if (!groupId) throw new Error('No groupId provided')
      await updateMemberStatus(targetUserId, groupId, status)
    },
    [groupId]
  )

  return {
    group,
    members,
    currentMember,
    isAdminOrCoAdmin,
    isLoading,
    error,
    handleCreateGroup,
    handleJoinByCode,
    handleUpdateGroup,
    handleUpdateMemberRole,
    handleUpdateMemberStatus,
  }
}
