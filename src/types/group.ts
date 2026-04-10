import { Timestamp } from 'firebase/firestore'

export type Group = {
  id: string
  ownerId: string
  challengeTitle: string
  challengeDescription: string
  dailyDeadline: string // "HH:MM" e.g. "23:59"
  mode: 'competitive' | 'collaborative'
  inviteCode: string
  createdAt: Timestamp
}

export type CreateGroupData = {
  challengeTitle: string
  challengeDescription: string
  dailyDeadline: string
  mode: 'competitive' | 'collaborative'
}
