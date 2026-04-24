// Invite-code utilities. The alphabet is the single source of truth shared with:
//   - supabase/migrations/0004_phase2_groups_invites.sql generate_invite_code()
//   - src/features/groups/schemas.ts joinCodeSchema regex
// 31 chars = digits 2-9 + A-Z minus O/I/L (ambiguity-stripped per CONTEXT D-02).

export const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Strip any characters outside the alphabet, uppercase, and slice to 8.
 * Input may arrive from a paste with dashes, whitespace, or mixed case.
 */
export function normalizeInviteCode(input: string): string {
  const upper = input.toUpperCase();
  let out = '';
  for (const ch of upper) {
    if (INVITE_ALPHABET.includes(ch)) {
      out += ch;
      if (out.length === 8) break;
    }
  }
  return out;
}

/**
 * Format a raw code into the chunked display form `XXXX-XXXX`.
 * For in-progress typing (length < 8), preserves gracefully:
 *   - ≤ 4 chars → return as-is (no dash yet)
 *   - 5..7 chars → inserts dash after char 4 ('ABCDE' → 'ABCD-E')
 */
export function formatInviteCode(raw: string): string {
  if (raw.length <= 4) return raw;
  return raw.slice(0, 4) + '-' + raw.slice(4);
}

/**
 * Exactly 8 chars, all in alphabet, case-sensitive (uppercase-only).
 */
export function isValidInviteCode(raw: string): boolean {
  if (raw.length !== 8) return false;
  for (const ch of raw) {
    if (!INVITE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
