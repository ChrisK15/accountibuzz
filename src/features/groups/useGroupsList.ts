// List of groups the current user is a member of.
// Query key: ['groups']; staleTime 30s (refocus refetch is handled by default).
// RLS filters to caller's groups via group_members!inner aggregate (02-RESEARCH §Code Examples).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface GroupsListRow {
  id: string;
  name: string;
  goal: string;
  submission_type: 'photo' | 'video';
  timezone: string;
  member_count: number;
  admin_user_id: string;
}

export function useGroupsList() {
  return useQuery({
    queryKey: ['groups'],
    staleTime: 30_000,
    queryFn: async (): Promise<GroupsListRow[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select(
          'id, name, goal, submission_type, timezone, admin_user_id, group_members!inner(count)',
        )
        .order('name');
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        name: string;
        goal: string;
        submission_type: 'photo' | 'video';
        timezone: string;
        admin_user_id: string;
        group_members?: Array<{ count?: number }>;
      }>;
      return rows.map((g) => ({
        id: g.id,
        name: g.name,
        goal: g.goal,
        submission_type: g.submission_type,
        timezone: g.timezone,
        admin_user_id: g.admin_user_id,
        member_count: g.group_members?.[0]?.count ?? 0,
      }));
    },
  });
}
