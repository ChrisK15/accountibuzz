import {
  createGroupSchema,
  joinCodeSchema,
} from '../../src/features/groups/schemas';

describe('createGroupSchema', () => {
  const valid = {
    name: 'Morning runners',
    goal: 'Post a photo of your run before 9am.',
    submission_type: 'photo' as const,
    timezone: 'America/Los_Angeles',
  };

  it('accepts a canonical valid input', () => {
    const parsed = createGroupSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects empty name with exact UI-SPEC copy', () => {
    const parsed = createGroupSchema.safeParse({ ...valid, name: '' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.message);
      expect(issues).toContain('Give your group a name.');
    }
  });

  it('rejects 61-char name with exact UI-SPEC copy', () => {
    const parsed = createGroupSchema.safeParse({ ...valid, name: 'x'.repeat(61) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.message);
      expect(issues).toContain('Keep the name short — 60 characters max.');
    }
  });

  it('rejects 4-char goal with exact UI-SPEC copy', () => {
    const parsed = createGroupSchema.safeParse({ ...valid, goal: 'abcd' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.message);
      expect(issues).toContain('Add a bit more detail — at least 5 characters.');
    }
  });

  it('rejects 141-char goal with exact UI-SPEC copy', () => {
    const parsed = createGroupSchema.safeParse({ ...valid, goal: 'x'.repeat(141) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.message);
      expect(issues).toContain('Keep it short — 140 characters max.');
    }
  });

  it('rejects submission_type "audio" (enum violation)', () => {
    const parsed = createGroupSchema.safeParse({ ...valid, submission_type: 'audio' });
    expect(parsed.success).toBe(false);
  });

  it('accepts submission_type "video"', () => {
    const parsed = createGroupSchema.safeParse({ ...valid, submission_type: 'video' });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty timezone', () => {
    const parsed = createGroupSchema.safeParse({ ...valid, timezone: '' });
    expect(parsed.success).toBe(false);
  });
});

describe('joinCodeSchema', () => {
  it('accepts ABCD2345 (all in 31-char alphabet)', () => {
    const parsed = joinCodeSchema.safeParse({ code: 'ABCD2345' });
    expect(parsed.success).toBe(true);
  });

  it('rejects ABCD234O (contains O, not in alphabet)', () => {
    const parsed = joinCodeSchema.safeParse({ code: 'ABCD234O' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.message);
      expect(issues).toContain('Codes are 8 letters and numbers. Check for typos.');
    }
  });

  it('rejects lowercase (schema validates post-normalization)', () => {
    const parsed = joinCodeSchema.safeParse({ code: 'abcd2345' });
    expect(parsed.success).toBe(false);
  });

  it('rejects 7-char code ABCD234', () => {
    const parsed = joinCodeSchema.safeParse({ code: 'ABCD234' });
    expect(parsed.success).toBe(false);
  });

  it('rejects 9-char code ABCD23451', () => {
    const parsed = joinCodeSchema.safeParse({ code: 'ABCD23451' });
    expect(parsed.success).toBe(false);
  });

  it('rejects codes with ambiguous I character', () => {
    const parsed = joinCodeSchema.safeParse({ code: 'ABCDIEF2' });
    expect(parsed.success).toBe(false);
  });

  it('rejects codes with ambiguous L character', () => {
    const parsed = joinCodeSchema.safeParse({ code: 'ABCDLEF2' });
    expect(parsed.success).toBe(false);
  });
});
