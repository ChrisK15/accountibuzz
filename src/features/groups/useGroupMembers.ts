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
  // WR-04: stable sort key — ties between admin/member rows resolve by
  // joined_at ascending (earliest-joined first).
  joined_at: string;
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group', groupId, 'members'],
    enabled: !!groupId,
    queryFn: async (): Promise<MemberRow[]> => {
      // WR-04: deterministic order — admin first, then members by joined_at.
      // 'admin' > 'member' alphabetically, so { ascending: false } puts admin
      // at the top; joined_at ascending yields earliest-joined member next.
      // Prevents flicker between renders after refetch (PostgREST otherwise
      // returns physical-row order, which is not guaranteed stable).
      const { data, error } = await supabase
        .from('group_members')
        .select(
          'user_id, role, joined_at, profiles(display_name, avatar_path, updated_at)',
        )
        .eq('group_id', groupId!)
        .order('role', { ascending: false })
        .order('joined_at', { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{
        user_id: string;
        role: 'admin' | 'member';
        joined_at: string;
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
        joined_at: r.joined_at,
        display_name: r.profiles?.display_name ?? null,
        avatar_path: r.profiles?.avatar_path ?? null,
        updated_at: r.profiles?.updated_at ?? null,
      }));
    },
  });
}
