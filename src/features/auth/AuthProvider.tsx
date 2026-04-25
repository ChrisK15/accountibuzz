import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';

// WR-01 (iter 2): persist recovery intent across cold start. `PASSWORD_RECOVERY`
// does not fire on cold start — only `INITIAL_SESSION` does — so if a user
// kills the app mid-reset we restore the session, find `recoveryPending=false`,
// and auto-promote into /(app). Persisting the flag to AsyncStorage lets us
// restore it alongside the session on getSession and keep the reset gate closed.
// AsyncStorage (not SecureStore): this is a boolean flag, not a secret.
export const RECOVERY_PENDING_KEY = 'accountibuzz.recoveryPending';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /**
   * True between a PASSWORD_RECOVERY event and the next USER_UPDATED /
   * SIGNED_OUT event. While true, `useProtectedRoute` must force the user
   * onto `/(auth)/reset-password` regardless of session presence — see
   * WR-01 in .planning/phases/01-foundation/01-REVIEW.md.
   */
  recoveryPending: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryPending, setRecoveryPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    // WR-01 (iter 2): restore persisted recovery intent before flipping
    // `loading` off, so the gate effect in `app/_layout.tsx` sees the flag on
    // the same render as the session. Otherwise the first post-loading render
    // would route into /(app) before the flag arrived.
    Promise.all([
      supabase.auth.getSession(),
      AsyncStorage.getItem(RECOVERY_PENDING_KEY).catch(() => null),
    ])
      .then(([{ data }, pending]) => {
        if (!mounted) return;
        setSession(data.session);
        // Only treat the flag as live if we also have a session. A stale flag
        // with no session (e.g. user cleared data) should not pin /(auth).
        if (data.session && pending === '1') setRecoveryPending(true);
      })
      .catch((err) => {
        // Storage adapter or hex-decode failures should not leave the
        // splash stuck forever. Log and fall through to the finally block
        // so `loading` still flips false. (WR-05)
        console.warn('[AuthProvider] getSession failed', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e === 'PASSWORD_RECOVERY') {
        setRecoveryPending(true);
        AsyncStorage.setItem(RECOVERY_PENDING_KEY, '1').catch(() => {});
      }
      if (e === 'USER_UPDATED' || e === 'SIGNED_OUT') {
        setRecoveryPending(false);
        AsyncStorage.removeItem(RECOVERY_PENDING_KEY).catch(() => {});
      }
      // Clear all React Query caches on sign-out so the next signed-in user
      // does not see stale data from the previous session. The cache key
      // namespace is shared across users (e.g. ['groups']), so without this
      // a sign-in immediately following a sign-out can render the previous
      // user's empty/populated list. Caught during 02-07 manual UAT.
      if (e === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        recoveryPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSession(): AuthContextValue {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useSession must be used inside <AuthProvider>');
  return c;
}
