// Currently-active invite for a group (admin-visible via RLS from 0004 migration).
// Query key: ['group', groupId, 'invite']. Returns null when no live invite exists
// (common for non-admins whose RLS filters it out, or for admin right before first regenerate).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface ActiveInviteRow {
  code: string;
  expires_at: string;
}

export function useActiveInvite(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group', groupId, 'invite'],
    enabled: !!groupId,
    queryFn: async (): Promise<ActiveInviteRow | null> => {
      const { data, error } = await supabase
        .from('invites')
        .select('code, expires_at')
        .eq('group_id', groupId!)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as ActiveInviteRow | null) ?? null;
    },
  });
}
