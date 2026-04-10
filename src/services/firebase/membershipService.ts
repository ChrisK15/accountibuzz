/**
 * membershipService.ts
 * Handles all Firestore operations for group membership — joining groups,
 * checking membership, and updating roles/status. Works on the sub-collection:
 *   groups/{groupId}/members/{userId}
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import { type GroupMember, type MemberRole, type MemberStatus } from '@/types/membership'

/**
 * joinGroup
 * Adds the user as a 'member' of the group. Called after the user taps an
 * invite link and confirms they want to join. Does nothing if they're already
 * a member (setDoc with merge: true is idempotent).
 */
export async function joinGroup(userId: string, groupId: string): Promise<void> {
  const memberRef = doc(db, 'groups', groupId, 'members', userId)
  const userSnap = await getDoc(doc(db, 'users', userId))
  const displayName: string = userSnap.data()?.displayName ?? 'Unknown'
  await setDoc(
    memberRef,
    {
      userId,
      groupId,
      displayName,
      role: 'member',
      status: 'active',
      joinedAt: serverTimestamp(),
    },
    { merge: true }
  )
  await updateDoc(doc(db, 'users', userId), { groupIds: arrayUnion(groupId) })
}

/**
 * getMember
 * Fetches a single member doc. Returns null if the user is not in this group.
 * Useful for checking membership before showing group content.
 */
export async function getMember(
  userId: string,
  groupId: string
): Promise<GroupMember | null> {
  const snap = await getDoc(doc(db, 'groups', groupId, 'members', userId))
  if (!snap.exists()) return null
  return snap.data() as GroupMember
}

/**
 * subscribeToMembers
 * Live listener for the full member list of a group. Fires onData whenever
 * any member doc changes (role update, sabbatical toggle, new join, etc).
 * Returns an unsubscribe function — call it on screen unmount.
 */
export function subscribeToMembers(
  groupId: string,
  onData: (members: GroupMember[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'groups', groupId, 'members'), snap => {
    onData(snap.docs.map(d => d.data() as GroupMember))
  })
}

/**
 * updateMemberRole
 * Promotes or demotes a member. Only callable by the group admin.
 * The permission check happens in Firestore security rules, not here.
 */
export async function updateMemberRole(
  userId: string,
  groupId: string,
  role: MemberRole
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'members', userId), { role })
}

/**
 * updateMemberStatus
 * Toggles a member's sabbatical status. Members update their own doc;
 * admins can update any member's doc (enforced by Firestore rules).
 */
export async function updateMemberStatus(
  userId: string,
  groupId: string,
  status: MemberStatus
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'members', userId), { status })
}
