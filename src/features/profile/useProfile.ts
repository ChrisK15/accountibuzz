import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface ProfileRow {
  id: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_path, created_at, updated_at')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data as ProfileRow;
    },
  });
}
