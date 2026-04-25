// Deep-link landing (02-UI-SPEC.md §"Deep-link landing" lines 407-417).
//
// CRITICAL: this file lives OUTSIDE the `(app)` route group so it renders for
// unauthenticated users per 02-RESEARCH.md §Pattern 3 + 02-PATTERNS.md line 347.
//
// Four render branches:
//   (a) sessionLoading || previewPending → skeleton card
//   (b) preview error / invalid code → "Invite not found"
//   (c) preview ready + NO session → "{admin} invited you" with 'Sign in to join'
//   (d) preview ready + session → "Ready to join?" with 'Join group' → redeem
//
// INVARIANTS (T-02-INV-REPLAY):
//   • NEVER call SecureStore.deleteItemAsync here — clearing is owned by
//     useRedeemInvite.onSuccess per Pitfall 6.
//   • Preview renders BEFORE any route change to auth — user taps drive routing.
//   • Gate render on BOTH sessionLoading AND previewPending (cold-start race).

import { useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useInvitePreview } from '../../src/features/groups/useInvitePreview';
import { useRedeemInvite } from '../../src/features/groups/useRedeemInvite';
import { useSession } from '../../src/features/auth/AuthProvider';
import { normalizeInviteCode } from '../../src/features/groups/formatInviteCode';
import { PENDING_INVITE_KEY } from '../../src/features/groups/usePendingInviteReplay';
import { useTheme } from '../../src/theme/useTheme';
import type { Theme } from '../../src/theme/useTheme';
import {
  ScreenContainer,
  ScreenHeader,
  PrimaryButton,
  GhostButton,
} from '../../src/components';

export default function InviteLandingScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const rawCode = (params.code ?? '').toString();
  // WR-02: normalize so dashed forms like `ABCD-EF12` from manually-typed URLs
  // are equivalent to the raw 8-char share-sheet form `ABCDEF12`. Also handles
  // lowercase and incidental whitespace.
  const code = normalizeInviteCode(rawCode);

  const { session, loading: sessionLoading } = useSession();
  const {
    data: preview,
    isPending: previewPending,
    isError: previewHasError,
    error: previewError,
  } = useInvitePreview(code);
  const redeem = useRedeemInvite();
  const [joinError, setJoinError] = useState<string | null>(null);

  // If the URL param is shorter than 8 chars, treat as "invite not found" —
  // useInvitePreview's `enabled` guard would leave us stuck on loading forever.
  const invalidCodeShape = code.length !== 8;

  // Branch (a): loading skeleton — only while genuinely waiting.
  // `previewPending` stays true forever if `enabled: false` (invalid shape), so
  // we short-circuit that case into the not-found branch below.
  if (!invalidCodeShape && (sessionLoading || previewPending)) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: false }} />
        <SkeletonPreviewCard t={t} />
      </ScreenContainer>
    );
  }

  // Branch (b): preview error → Invite not found.
  if (invalidCodeShape || previewHasError || !preview) {
    // Log for diagnostics; do NOT reveal the typed error to the user — any
    // invalid/expired/used code collapses to the same "Invite not found" copy
    // (T-02-PREVIEW-LEAK mitigation).
    if (previewError) {
      // Intentionally swallowed — see threat model.
    }
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader
          title="Invite not found"
          subtitle="We don't know that code. Double-check it with whoever invited you."
        />
        <View style={{ marginTop: t.spacing.lg, alignItems: 'center' }}>
          <GhostButton
            label="Back to groups"
            onPress={() => router.replace('/')}
          />
        </View>
      </ScreenContainer>
    );
  }

  // Branch (c): unauthenticated — show preview + auth-detour buttons.
  if (!session) {
    const onSignIn = async () => {
      await SecureStore.setItemAsync(PENDING_INVITE_KEY, code);
      router.replace('/(auth)/login');
    };
    const onSignUp = async () => {
      await SecureStore.setItemAsync(PENDING_INVITE_KEY, code);
      router.replace('/(auth)/signup');
    };
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            paddingVertical: t.spacing.xl,
            gap: t.spacing.lg,
            alignItems: 'center',
          }}
        >
          <Text
            style={[
              t.fonts.display,
              { color: t.colors.textStrong, textAlign: 'center' },
            ]}
          >
            {`${preview.admin_display_name || 'Someone'} invited you`}
          </Text>
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.textMuted, textAlign: 'center' },
            ]}
          >
            {`Join ${preview.group_name || 'the group'} — ${preview.member_count} already in.`}
          </Text>
          <View style={{ width: '100%', marginTop: t.spacing.lg }}>
            <PrimaryButton label="Sign in to join" onPress={onSignIn} />
          </View>
          <Pressable
            onPress={onSignUp}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text
              style={[
                t.fonts.body,
                { color: t.colors.accent, fontWeight: '700' },
              ]}
            >
              Create an account to join
            </Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // Branch (d): authenticated — ready to redeem.
  const onJoin = async () => {
    setJoinError(null);
    try {
      const groupId = await redeem.mutateAsync(code);
      // useRedeemInvite.onSuccess already clears PENDING_INVITE_KEY; do NOT
      // duplicate that clear here.
      router.replace(`/groups/${groupId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      switch (msg) {
        case 'group_full':
          setJoinError(
            "This group's already at 10 members. Ask the admin to make room or start your own.",
          );
          break;
        case 'invite_expired':
          setJoinError(
            'This invite expired. Ask the admin for a fresh code.',
          );
          break;
        case 'invite_already_used':
          setJoinError(
            "This code's already been used. Ask the admin for a new one.",
          );
          break;
        case 'already_member':
          setJoinError("You're already in this group. Head on over.");
          break;
        case 'invite_not_found':
          setJoinError(
            "We don't know that code. Double-check it with whoever invited you.",
          );
          break;
        default:
          setJoinError(
            'Something went sideways. Check your connection and try again.',
          );
      }
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingVertical: t.spacing.xl,
          gap: t.spacing.lg,
          alignItems: 'center',
        }}
      >
        <Text
          style={[
            t.fonts.display,
            { color: t.colors.textStrong, textAlign: 'center' },
          ]}
        >
          Ready to join?
        </Text>
        <Text
          style={[
            t.fonts.body,
            { color: t.colors.textMuted, textAlign: 'center' },
          ]}
        >
          {`You're about to join ${preview.group_name}.`}
        </Text>
        <View style={{ width: '100%', marginTop: t.spacing.lg }}>
          <PrimaryButton
            label="Join group"
            onPress={onJoin}
            loading={redeem.isPending}
          />
        </View>
        <GhostButton
          label="Not now"
          onPress={() => router.replace('/(app)/')}
        />
        {joinError ? (
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.destructive, textAlign: 'center' },
            ]}
          >
            {joinError}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

// Skeleton preview card — three surface-muted blocks approximating the preview
// (avatar/title/subtitle/cta). Pure visual placeholder; no data dependency.
function SkeletonPreviewCard({ t }: { t: Theme }) {
  return (
    <View
      accessibilityLabel="Loading invite"
      style={{
        paddingVertical: t.spacing.xl,
        gap: t.spacing.lg,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: t.radii.pill,
          backgroundColor: t.colors.surfaceMuted,
        }}
      />
      <View
        style={{
          width: '70%',
          height: 32,
          borderRadius: t.radii.sm,
          backgroundColor: t.colors.surfaceMuted,
        }}
      />
      <View
        style={{
          width: '90%',
          height: 20,
          borderRadius: t.radii.sm,
          backgroundColor: t.colors.surfaceMuted,
        }}
      />
      <View
        style={{
          width: '100%',
          height: 48,
          borderRadius: t.radii.md,
          backgroundColor: t.colors.surfaceMuted,
          marginTop: t.spacing.lg,
        }}
      />
    </View>
  );
}
