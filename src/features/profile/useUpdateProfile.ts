import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name: string }) => {
      // WR-06: reject on missing identity instead of silently no-op'ing
      // (.eq('id', '') would match zero rows and report success).
      if (!userId) throw new Error('useUpdateProfile: no userId');
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: input.display_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
