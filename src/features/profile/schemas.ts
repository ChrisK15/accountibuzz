import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'At least 2 characters')
  .max(32, 'At most 32 characters');

export const profileUpdateSchema = z.object({
  display_name: displayNameSchema,
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
