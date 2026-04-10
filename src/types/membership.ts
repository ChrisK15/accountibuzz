import { Timestamp } from 'firebase/firestore'

// Stored at: groups/{groupId}/members/{userId}
// userId + groupId are stored on the doc itself so we can query across groups.

export type MemberRole = 'admin' | 'co_admin' | 'member'
export type MemberStatus = 'active' | 'on_sabbatical'

export type GroupMember = {
  userId: string
  groupId: string
  displayName: string
  role: MemberRole
  status: MemberStatus
  joinedAt: Timestamp
}
