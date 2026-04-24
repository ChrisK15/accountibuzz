// redeem_invite RPC wrapper. Arg: raw 8-char code; returns the joined group_id.
// onSuccess: clear the PENDING_INVITE_KEY (T-02-INV-REPLAY mitigation) + invalidate
// the groups list, the new group, and its members cache.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../lib/supabase';
import { PENDING_INVITE_KEY } from './usePendingInviteReplay';

export function useRedeemInvite() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (code) => {
      const { data, error } = await supabase.rpc('redeem_invite', {
        code_input: code,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: async (groupId) => {
      // T-02-INV-REPLAY: clear only on successful redemption. Failure paths
      // (invite_expired / already_member / etc.) preserve the key so the user
      // can retry after the admin regenerates or they open the invited group.
      try {
        await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
      } catch {
        // SecureStore failures must not block cache invalidation.
      }
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['group', groupId, 'members'] });
    },
  });
}
