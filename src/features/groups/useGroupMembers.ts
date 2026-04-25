// Group members list — join profile display_name + avatar_path.
// Query key: ['group', groupId, 'members'].

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface MemberRow {
  user_id: string;
  role: 'admin' | 'member';
  display_name: string | null;
  avatar_path: string | null;
  // WR-01: include profiles.updated_at so member-row avatars can bust the
  // expo-image URL cache after an avatar upload (stable `{userId}/avatar.jpg`
  // path would otherwise serve a stale image).
  updated_at: string | null;
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group', groupId, 'members'],
    enabled: !!groupId,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select(
          'user_id, role, profiles(display_name, avatar_path, updated_at)',
        )
        .eq('group_id', groupId!);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{
        user_id: string;
        role: 'admin' | 'member';
        profiles:
          | {
              display_name: string | null;
              avatar_path: string | null;
              updated_at: string | null;
            }
          | null;
      }>;
      return rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        display_name: r.profiles?.display_name ?? null,
        avatar_path: r.profiles?.avatar_path ?? null,
        updated_at: r.profiles?.updated_at ?? null,
      }));
    },
  });
}
