import {
  INVITE_ALPHABET,
  normalizeInviteCode,
  formatInviteCode,
  isValidInviteCode,
} from '../../src/features/groups/formatInviteCode';

describe('INVITE_ALPHABET', () => {
  it('matches the exact 31-char migration alphabet (0004_phase2_groups_invites.sql)', () => {
    expect(INVITE_ALPHABET).toBe('23456789ABCDEFGHJKMNPQRSTUVWXYZ');
    expect(INVITE_ALPHABET).toHaveLength(31);
  });
});

describe('normalizeInviteCode', () => {
  // NOTE: the 31-char alphabet excludes '0', '1', 'O', 'I', 'L' (ambiguity-stripped
  // per CONTEXT D-02). Every test code here uses only digits 2-9 + A-Z minus O/I/L,
  // which fixes a drift between the plan's illustrative 'ABCDEF12' examples and
  // the authoritative alphabet pinned to the 0004 migration.
  it('strips dashes and uppercases', () => {
    expect(normalizeInviteCode('abcd-ef23')).toBe('ABCDEF23');
  });

  it('strips whitespace, symbols, underscores', () => {
    expect(normalizeInviteCode('  ab@cd-EF_23  ')).toBe('ABCDEF23');
  });

  it('slices to 8 characters', () => {
    expect(normalizeInviteCode('ABCDEF23456')).toBe('ABCDEF23');
  });

  it('returns empty string when every character is outside the alphabet', () => {
    // 0, O, I, L, 1 are all ambiguous → none are in the 31-char alphabet
    expect(normalizeInviteCode('0OIL1')).toBe('');
  });

  it('handles empty input', () => {
    expect(normalizeInviteCode('')).toBe('');
  });
});

describe('formatInviteCode', () => {
  it('chunks an 8-char code as XXXX-XXXX', () => {
    expect(formatInviteCode('ABCDEF12')).toBe('ABCD-EF12');
  });

  it('passes a 4-or-fewer-char fragment through unhyphenated', () => {
    expect(formatInviteCode('ABCD')).toBe('ABCD');
    expect(formatInviteCode('ABC')).toBe('ABC');
  });

  it('inserts the dash after char 4 for in-progress typing', () => {
    expect(formatInviteCode('ABCDE')).toBe('ABCD-E');
    expect(formatInviteCode('ABCDEF1')).toBe('ABCD-EF1');
  });

  it('returns empty string for empty input', () => {
    expect(formatInviteCode('')).toBe('');
  });
});

describe('isValidInviteCode', () => {
  // Valid-sample codes use only chars in the 31-char alphabet (no 0/1/I/L/O).
  it('returns true for an 8-char uppercase alphabet code', () => {
    expect(isValidInviteCode('ABCDEF23')).toBe(true);
  });

  it('returns true for an all-digit code within the alphabet', () => {
    expect(isValidInviteCode('23456789')).toBe(true);
  });

  it('returns false for lowercase (case-sensitive)', () => {
    expect(isValidInviteCode('abcdef23')).toBe(false);
  });

  it('returns false when code contains O (outside alphabet)', () => {
    expect(isValidInviteCode('ABCDEF2O')).toBe(false);
  });

  it('returns false when code contains 1 (outside alphabet — ambiguous with I/L)', () => {
    expect(isValidInviteCode('ABCDEF21')).toBe(false);
  });

  it('returns false for a 7-char code', () => {
    expect(isValidInviteCode('ABCDEF2')).toBe(false);
  });

  it('returns false for a 9-char code', () => {
    expect(isValidInviteCode('ABCDEF234')).toBe(false);
  });
});
