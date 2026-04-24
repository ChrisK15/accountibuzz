// leave_group RPC wrapper. Rejected server-side with 'admin_cannot_leave' if caller
// is the admin; screens handle that branch via error.message.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (groupId) => {
      const { error } = await supabase.rpc('leave_group', {
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
