import { displayNameSchema } from '../src/features/profile/schemas';

describe('displayNameSchema', () => {
  it('rejects too short / too long / whitespace-only', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false);
    expect(displayNameSchema.safeParse('A').success).toBe(false);
    expect(displayNameSchema.safeParse('  ').success).toBe(false); // trims to empty
    expect(displayNameSchema.safeParse('X'.repeat(33)).success).toBe(false);
  });
  it('accepts 2-32 chars including unicode + emoji', () => {
    expect(displayNameSchema.safeParse('Al').success).toBe(true);
    expect(displayNameSchema.safeParse('Alex Rivera').success).toBe(true);
    expect(displayNameSchema.safeParse('🔥 Flame').success).toBe(true);
    expect(displayNameSchema.safeParse('X'.repeat(32)).success).toBe(true);
  });
  it('trims surrounding whitespace before length check', () => {
    const parsed = displayNameSchema.safeParse('  Alex  ');
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe('Alex');
  });
});
