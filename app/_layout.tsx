import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { queryClient } from '../src/lib/queryClient';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthProvider, useSession } from '../src/features/auth/AuthProvider';
import { usePendingInviteReplay } from '../src/features/groups/usePendingInviteReplay';
import { startQueueManager } from '../src/features/submissions/uploadQueueManager';

function useProtectedRoute() {
  const { session, loading, recoveryPending } = useSession();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const inApp = segments[0] === '(app)';
    // Recovery session exemption: after verifyOtp with type=recovery, a session
    // exists but the user still needs to call updateUser on the reset screen.
    // Keep them on /(auth)/reset-password until they set a new password.
    const onResetPassword = inAuth && (segments as string[])[1] === 'reset-password';
    // Invite-landing exemption: /invite/[code] lives outside both (auth) and
    // (app) so it renders for both unauthed users (preview + 'Sign in to join')
    // and authed users (preview + 'Join group'). Without this exemption the
    // gate would bounce unauthed users to /(auth)/login and authed users to
    // /(app)/, defeating the deep-link redemption flow (INV-02).
    const onInviteLanding = segments[0] === 'invite';

    // WR-01: while a password-recovery session is pending (verifyOtp succeeded
    // but updateUser has not yet fired), pin the user to /(auth)/reset-password
    // regardless of which (auth) route they navigate to. This closes the
    // "navigate away from reset → auto-promoted into /(app)" escape hatch
    // (hardware back, iOS swipe, the 'Request a new code' link, etc.).
    if (recoveryPending) {
      if (!onResetPassword) {
        router.replace('/(auth)/reset-password');
      }
      return;
    }

    if (!session && !inAuth && !onInviteLanding) {
      router.replace('/(auth)/login');
    } else if (session && !inApp && !onResetPassword && !onInviteLanding) {
      router.replace('/(app)/');
    }
  }, [session, loading, recoveryPending, segments, router]);
}

function useUploadQueueManager() {
  // P3-06: wire AppState + NetInfo flush triggers ONCE for the lifetime of the
  // app. The queue manager's `flushQueue(session)` no-ops when session is null
  // (signed-out) per Plan 03-03, so calling it on every transition is safe.
  //
  // sessionRef is synced via a separate useEffect so the getSession callback
  // returned to startQueueManager always reads the LATEST session (not the
  // closure-captured value at first mount). Without this, signing in after
  // the app has been open with no session would leave startQueueManager
  // forever calling flushQueue(null).
  const { session } = useSession();
  const sessionRef = useRef<Session | null>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const unsubscribe = startQueueManager(() => sessionRef.current);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function RootGate() {
  useProtectedRoute();
  // P2 auth-detour replay: after a user authenticates from a deep-link invite,
  // this hook reads PENDING_INVITE_KEY from SecureStore and routes back to
  // /invite/[code]. Ordered AFTER useProtectedRoute so the recovery-password
  // gate still wins priority (its effect fires first). See 02-PATTERNS.md §699.
  usePendingInviteReplay();
  // P3-06: AppState + NetInfo flush triggers for the offline upload queue.
  useUploadQueueManager();
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootGate />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
