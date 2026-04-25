-- Phase 2 follow-up: co-member profile visibility.
--
-- The existing profiles_select_own policy (P1) only allows users to read
-- their own profile row. The group-detail screen (P2 plan 02-04) embeds
-- profile fields via PostgREST `profiles(display_name, avatar_path)`, which
-- goes through RLS — so member rendering shows "Unnamed" for everyone except
-- the viewer.
--
-- Caught during 02-07 manual UAT (Checkpoint G). Architectural intent of P2
-- was direct table reads + RLS for member listing (no get_group_members RPC
-- shipped in 02-02). This migration completes that intent.
--
-- Privacy boundary: a viewer can read another profile only if they share at
-- least one group with that user. Pairs with profiles_select_own.

CREATE POLICY "profiles_select_co_member" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members gm_self
      JOIN public.group_members gm_other
        ON gm_other.group_id = gm_self.group_id
      WHERE gm_self.user_id = auth.uid()
        AND gm_other.user_id = profiles.id
    )
  );
