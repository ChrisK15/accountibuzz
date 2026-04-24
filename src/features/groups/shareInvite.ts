// Native share-sheet wrapper for the invite code.
// Message is LOCKED by 02-UI-SPEC.md §"Native share-sheet message" + CONTEXT D-19.
// The `<store link placeholder>` literal is intentional and will be replaced in Phase 6.

import { Share } from 'react-native';
import { formatInviteCode } from './formatInviteCode';

export async function shareInvite(
  groupName: string,
  rawCode: string,
): Promise<void> {
  const formatted = formatInviteCode(rawCode);
  const message = `Join my Accountibuzz group ${groupName}: code ${formatted}
Or open: accountibuzz://invite/${rawCode}
(Get the app: <store link placeholder>)`;
  try {
    await Share.share({ message });
  } catch {
    // Share sheet dismissal / unavailable → best-effort, do not throw.
  }
}
