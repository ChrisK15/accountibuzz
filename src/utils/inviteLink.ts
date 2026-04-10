/**
 * inviteLink.ts
 * Pure utility functions for building and parsing invite URLs.
 * No Firebase, no state — just string manipulation using expo-linking.
 *
 * Invite URL format: accountibuzz://join?code=XXXXXXXX
 */

import * as Linking from 'expo-linking'

/**
 * buildInviteURL
 * Turns an 8-character invite code into a deep link the user can share.
 * expo-linking handles the scheme prefix so it works on both Android and iOS.
 */
export function buildInviteURL(inviteCode: string): string {
  return Linking.createURL('join', { queryParams: { code: inviteCode } })
}

/**
 * parseInviteCode
 * Extracts the invite code from a deep link URL. Returns null if the URL
 * isn't a valid invite link (e.g. user opened a different kind of deep link).
 */
export function parseInviteCode(url: string): string | null {
  const { path, queryParams } = Linking.parse(url)
  if (path !== 'join') return null
  const code = queryParams?.code
  return typeof code === 'string' ? code.toUpperCase() : null
}
