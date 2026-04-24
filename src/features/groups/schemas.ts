// Zod schemas for Phase 2 create-group and join-code forms.
// Error copy locked by .planning/phases/02-groups-invites/02-UI-SPEC.md §"Error state copy".
// Invite alphabet (31 chars, 0/1/I/L/O ambiguity-stripped per CONTEXT D-02) must match:
//   - supabase/migrations/0004_phase2_groups_invites.sql generate_invite_code()
//   - src/features/groups/formatInviteCode.ts INVITE_ALPHABET
import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give your group a name.')
    .max(60, 'Keep the name short — 60 characters max.'),
  goal: z
    .string()
    .trim()
    .min(5, 'Add a bit more detail — at least 5 characters.')
    .max(140, 'Keep it short — 140 characters max.'),
  submission_type: z.enum(['photo', 'video']),
  timezone: z.string().min(1, 'Pick a timezone.'),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const joinCodeSchema = z.object({
  code: z
    .string()
    .regex(
      /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/,
      'Codes are 8 letters and numbers. Check for typos.',
    ),
});
export type JoinCodeInput = z.infer<typeof joinCodeSchema>;
