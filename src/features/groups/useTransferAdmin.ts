// transfer_admin RPC wrapper (atomic 3-row flip per 0004 migration).
// onSuccess: invalidate the group + members cache so both admin/non-admin rows
// refresh to reflect the new roles.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface TransferAdminInput {
  group_id: string;
  new_admin_user_id: string;
}

export function useTransferAdmin() {
  const qc = useQueryClient();
  return useMutation<void, Error, TransferAdminInput>({
    mutationFn: async (input) => {
      const { error } = await supabase.rpc('transfer_admin', {
        p_group_id: input.group_id,
        p_new_admin_user_id: input.new_admin_user_id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { group_id }) => {
      qc.invalidateQueries({ queryKey: ['group', group_id] });
      qc.invalidateQueries({ queryKey: ['group', group_id, 'members'] });
    },
  });
}
