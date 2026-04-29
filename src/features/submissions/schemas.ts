// Zod schemas for Phase 3 capture + admin-review forms.
// Error copy locked by .planning/phases/03-capture-admin-review/03-UI-SPEC.md
// §"Error state copy" (caption + reject reason 140-char boundary).
//
// SUB-06 (caption ≤ 140) and ADM-03 reject-reason boundary are server-enforced
// by 0006_phase3_capture_review.sql; these schemas are defense-in-depth + the
// source for FormError messages in Plans 03-05/07.
import { z } from 'zod';

// Caption: optional, single-line, ≤ 140 chars (D-04). Mirrors P2 goal-description pattern.
// The capture screen also enforces a visual char counter, so this fires only as
// defense-in-depth.
export const captionSchema = z
  .string()
  .max(140, 'Keep it short — 140 characters max.');

// Reject reason: optional, single-line, ≤ 140 chars (D-11).
export const rejectReasonSchema = z
  .string()
  .max(140, 'Keep it short — 140 characters max.');

// Submit payload (used by useSubmitToday client validation in Plan 03-05).
export const submitTodaySchema = z.object({
  groupId: z.string().uuid(),
  mediaLocalUri: z.string().min(1),
  mediaType: z.enum(['photo', 'video']),
  // Order matters: empty-string-to-null MUST be tried before captionSchema
  // (z.string().max(140) accepts ''), otherwise empty-string is accepted as a
  // string and never reaches the transform.
  caption: z.union([
    z.literal('').transform(() => null),
    z.null(),
    captionSchema,
  ]),
});
export type SubmitTodayInput = z.infer<typeof submitTodaySchema>;

// Review payload (used by useReviewSubmission in Plan 03-05).
export const reviewSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  // See note on `caption` above re: union ordering.
  rejectionReason: z.union([
    z.literal('').transform(() => null),
    z.null(),
    rejectReasonSchema,
  ]),
});
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
