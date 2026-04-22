import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

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
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
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
      if (e === 'PASSWORD_RECOVERY') setRecoveryPending(true);
      if (e === 'USER_UPDATED' || e === 'SIGNED_OUT') setRecoveryPending(false);
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
