// regenerate_invite RPC wrapper — closes the prior invite (sets used_at=now())
// and mints a new 8-char code. Returns the new code.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useRegenerateInvite() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (groupId) => {
      const { data, error } = await supabase.rpc('regenerate_invite', {
        p_group_id: groupId,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: (_, groupId) => {
      qc.invalidateQueries({ queryKey: ['group', groupId, 'invite'] });
    },
  });
}
