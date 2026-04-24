// Deep-link preview (anon-callable RPC). Query key: ['invitePreview', code].
// retry: false — typed errors (invite_not_found / invite_expired / invite_already_used)
// are terminal; screens branch on error.message.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface InvitePreview {
  group_name: string;
  member_count: number;
  admin_display_name: string;
}

export function useInvitePreview(code: string | undefined) {
  return useQuery({
    queryKey: ['invitePreview', code],
    enabled: !!code && code.length === 8,
    retry: false,
    queryFn: async (): Promise<InvitePreview> => {
      const { data, error } = await supabase.rpc('get_invite_preview', {
        code_input: code!,
      });
      if (error) throw new Error(error.message);
      // RPC returns the public.invite_preview composite type; all fields non-null on success.
      const preview = data as unknown as {
        group_name: string | null;
        member_count: number | null;
        admin_display_name: string | null;
      };
      return {
        group_name: preview.group_name ?? '',
        member_count: preview.member_count ?? 0,
        admin_display_name: preview.admin_display_name ?? '',
      };
    },
  });
}
