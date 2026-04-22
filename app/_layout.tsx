import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/queryClient';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthProvider, useSession } from '../src/features/auth/AuthProvider';

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

    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && !inApp && !onResetPassword) {
      router.replace('/(app)/profile');
    }
  }, [session, loading, recoveryPending, segments, router]);
}

function RootGate() {
  useProtectedRoute();
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
