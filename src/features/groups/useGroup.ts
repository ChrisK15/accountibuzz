// Single-group read hook. Query key: ['group', id].
// Enabled only when id is provided.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface GroupRow {
  id: string;
  name: string;
  goal: string;
  submission_type: 'photo' | 'video';
  timezone: string;
  admin_user_id: string;
  created_at: string;
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['group', id],
    enabled: !!id,
    queryFn: async (): Promise<GroupRow> => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, goal, submission_type, timezone, admin_user_id, created_at')
        .eq('id', id!)
        .single();
      if (error) throw new Error(error.message);
      return data as GroupRow;
    },
  });
}
