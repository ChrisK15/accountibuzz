// create_group RPC wrapper. Returns { group_id, invite_code } (first row of RETURNS TABLE).
// onSuccess: invalidate ['groups'] so the list refetches.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { CreateGroupInput } from './schemas';

export interface CreateGroupResult {
  group_id: string;
  invite_code: string;
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation<CreateGroupResult, Error, CreateGroupInput>({
    mutationFn: async (input): Promise<CreateGroupResult> => {
      const { data, error } = await supabase.rpc('create_group', {
        p_name: input.name,
        p_goal: input.goal,
        p_submission_type: input.submission_type,
        p_timezone: input.timezone,
      });
      if (error) throw new Error(error.message);
      const rows = data as unknown as Array<CreateGroupResult>;
      if (!rows || rows.length === 0) {
        throw new Error('create_group returned no row');
      }
      return rows[0];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
