/**
 * groupService.ts
 * Handles all Firestore operations for groups — creating, fetching, and
 * listening to group documents. All functions are plain async functions
 * (no classes). Screens never call Firestore directly — they go through here.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import { type Group, type CreateGroupData } from '@/types/group'

// Produces a random 8-character code like "A3FX9QZ2" for invite links.
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

/**
 * createGroup
 * Writes the GROUP doc and the creator's GROUP_MEMBER doc together in a single
 * batch so both succeed or both fail — no orphaned groups without an admin.
 * Also adds the groupId to the user's groupIds array for easy lookup.
 * Returns the new group's ID.
 */
export async function createGroup(
  userId: string,
  data: CreateGroupData
): Promise<string> {
  const groupRef = doc(collection(db, 'groups'))
  const memberRef = doc(db, 'groups', groupRef.id, 'members', userId)
  const userRef = doc(db, 'users', userId)

  const userSnap = await getDoc(userRef)
  const displayName: string = userSnap.data()?.displayName ?? 'Unknown'

  const batch = writeBatch(db)

  batch.set(groupRef, {
    ownerId: userId,
    challengeTitle: data.challengeTitle,
    challengeDescription: data.challengeDescription,
    dailyDeadline: data.dailyDeadline,
    mode: data.mode,
    inviteCode: generateInviteCode(),
    createdAt: serverTimestamp(),
  })

  batch.set(memberRef, {
    userId,
    groupId: groupRef.id,
    displayName,
    role: 'admin',
    status: 'active',
    joinedAt: serverTimestamp(),
  })

  // Store groupId on user doc so we can list groups without collectionGroup query.
  batch.update(userRef, { groupIds: arrayUnion(groupRef.id) })

  await batch.commit()
  return groupRef.id
}

/**
 * getGroup
 * One-time fetch of a single group by ID. Returns null if it doesn't exist.
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, 'groups', groupId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Group
}

/**
 * subscribeToGroup
 * Live listener for a single group. Fires onData every time the doc changes.
 * Returns an unsubscribe function — call it on screen unmount.
 */
export function subscribeToGroup(
  groupId: string,
  onData: (group: Group | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'groups', groupId), snap => {
    if (!snap.exists()) return onData(null)
    onData({ id: snap.id, ...snap.data() } as Group)
  })
}

/**
 * subscribeToUserGroups
 * Live listener for all groups the user belongs to. Reads the groupIds array
 * stored on the user doc — no collectionGroup query needed, no index required.
 */
export function subscribeToUserGroups(
  userId: string,
  onData: (groups: Group[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', userId),
    async snap => {
      try {
        if (!snap.exists()) { onData([]); return }
        const groupIds: string[] = snap.data().groupIds ?? []
        if (groupIds.length === 0) { onData([]); return }
        const results = await Promise.all(groupIds.map(id => getGroup(id)))
        onData(results.filter((g): g is Group => g !== null))
      } catch (e) {
        onError?.(e as Error)
      }
    },
    onError
  )
}

/**
 * updateGroup
 * Updates editable fields on a group doc. Only callable by admin/co-admin —
 * enforced by Firestore security rules, not here.
 */
export async function updateGroup(
  groupId: string,
  data: Partial<Pick<Group, 'challengeTitle' | 'challengeDescription' | 'dailyDeadline' | 'mode'>>
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), data)
}

/**
 * getGroupByInviteCode
 * Looks up a group by its 8-character invite code.
 */
export async function getGroupByInviteCode(code: string): Promise<Group | null> {
  const q = query(collection(db, 'groups'), where('inviteCode', '==', code))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Group
}
