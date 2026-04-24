// Post-auth replay of a persisted invite code.
//
// Flow (02-UI-SPEC.md §Interaction Contracts "Auth detour"):
//   1. Unauthenticated deep-link arrival → preview screen writes the raw code to
//      SecureStore under PENDING_INVITE_KEY, then routes to /login.
//   2. Post-login, this hook mounts in the app root layout. It reads the key,
//      and (if present) routes back to /invite/[code]. It DOES NOT clear the
//      key — clearing is owned by useRedeemInvite.onSuccess so failures can retry.
//
// Threat note (T-02-INV-REPLAY): the one-way clear-on-success invariant prevents
// server-side replay attacks (0004 migration's used_at stamp blocks server replay too).

import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useSession } from '../auth/AuthProvider';

export const PENDING_INVITE_KEY = 'accountibuzz.pendingInviteCode';

export function usePendingInviteReplay(): void {
  const { session, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading || !session) return;
    SecureStore.getItemAsync(PENDING_INVITE_KEY).then((code) => {
      if (!code) return;
      // DO NOT clear here — useRedeemInvite.onSuccess owns the clear.
      router.replace({ pathname: '/invite/[code]', params: { code } });
    }).catch(() => {
      // SecureStore hiccup should never block auth; swallow.
    });
  }, [session, loading, router]);
}
