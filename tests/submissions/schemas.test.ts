import {
  captionSchema,
  rejectReasonSchema,
  submitTodaySchema,
  reviewSubmissionSchema,
} from '../../src/features/submissions/schemas';

describe('captionSchema', () => {
  it('accepts empty string', () => {
    expect(captionSchema.safeParse('').success).toBe(true);
  });
  it('accepts 140 chars', () => {
    expect(captionSchema.safeParse('x'.repeat(140)).success).toBe(true);
  });
  it('rejects 141 chars with UI-SPEC error message', () => {
    const r = captionSchema.safeParse('x'.repeat(141));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/140 characters/);
  });
});

describe('rejectReasonSchema', () => {
  it('accepts empty string', () => {
    expect(rejectReasonSchema.safeParse('').success).toBe(true);
  });
  it('accepts 140 chars', () => {
    expect(rejectReasonSchema.safeParse('x'.repeat(140)).success).toBe(true);
  });
  it('rejects 141 chars with UI-SPEC error message', () => {
    const r = rejectReasonSchema.safeParse('x'.repeat(141));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/140 characters/);
  });
});

describe('submitTodaySchema', () => {
  // RFC 4122 v4-compliant uuids (zod v4 .uuid() enforces version+variant bits).
  const valid = {
    groupId: '11111111-1111-4111-8111-111111111111',
    mediaLocalUri: 'file:///tmp/photo.jpg',
    mediaType: 'photo' as const,
    caption: 'great run today',
  };
  it('accepts a valid input', () => {
    expect(submitTodaySchema.safeParse(valid).success).toBe(true);
  });
  it('rejects non-uuid groupId', () => {
    expect(
      submitTodaySchema.safeParse({ ...valid, groupId: 'not-a-uuid' }).success,
    ).toBe(false);
  });
  it('rejects empty mediaLocalUri', () => {
    expect(
      submitTodaySchema.safeParse({ ...valid, mediaLocalUri: '' }).success,
    ).toBe(false);
  });
  it('rejects mediaType other than photo|video', () => {
    expect(
      submitTodaySchema.safeParse({
        ...valid,
        // @ts-expect-error testing invalid enum
        mediaType: 'audio',
      }).success,
    ).toBe(false);
  });
  it('accepts mediaType=video', () => {
    expect(
      submitTodaySchema.safeParse({ ...valid, mediaType: 'video' }).success,
    ).toBe(true);
  });
  it('transforms empty-string caption to null', () => {
    const r = submitTodaySchema.safeParse({ ...valid, caption: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.caption).toBe(null);
  });
  it('accepts null caption', () => {
    const r = submitTodaySchema.safeParse({ ...valid, caption: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.caption).toBe(null);
  });
  it('rejects caption > 140 chars', () => {
    expect(
      submitTodaySchema.safeParse({ ...valid, caption: 'x'.repeat(141) })
        .success,
    ).toBe(false);
  });
});

describe('reviewSubmissionSchema', () => {
  const valid = {
    submissionId: '11111111-1111-4111-8111-111111111111',
    decision: 'approved' as const,
    rejectionReason: null,
  };
  it('accepts approved with null reason', () => {
    expect(reviewSubmissionSchema.safeParse(valid).success).toBe(true);
  });
  it('accepts rejected with reason text', () => {
    expect(
      reviewSubmissionSchema.safeParse({
        ...valid,
        decision: 'rejected',
        rejectionReason: 'thats not todays run',
      }).success,
    ).toBe(true);
  });
  it('transforms empty rejectionReason to null', () => {
    const r = reviewSubmissionSchema.safeParse({
      ...valid,
      decision: 'rejected',
      rejectionReason: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rejectionReason).toBe(null);
  });
  it('rejects invalid decision', () => {
    expect(
      reviewSubmissionSchema.safeParse({
        ...valid,
        // @ts-expect-error testing invalid enum
        decision: 'maybe',
      }).success,
    ).toBe(false);
  });
  it('rejects non-uuid submissionId', () => {
    expect(
      reviewSubmissionSchema.safeParse({ ...valid, submissionId: 'not-a-uuid' })
        .success,
    ).toBe(false);
  });
  it('rejects rejectionReason > 140 chars', () => {
    expect(
      reviewSubmissionSchema.safeParse({
        ...valid,
        decision: 'rejected',
        rejectionReason: 'x'.repeat(141),
      }).success,
    ).toBe(false);
  });
});
