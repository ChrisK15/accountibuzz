// delete_group RPC wrapper. Server cascades members/invites/submissions via FK
// ON DELETE CASCADE (0001 migration).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (groupId) => {
      const { error } = await supabase.rpc('delete_group', {
        p_group_id: groupId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, groupId) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.removeQueries({ queryKey: ['group', groupId] });
    },
  });
}
