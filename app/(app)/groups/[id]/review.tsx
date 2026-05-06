// Admin review queue — swipe-stack with reject-reason panel + first-review
// tooltip + empty state + reduced-motion fallback.
// Spec: 03-UI-SPEC.md §"Admin review queue" (lines 862-934);
//       §State Matrix lines 1014-1030;
//       §Reject-reason panel lines 902-917;
//       §First-review tooltip lines 424-432;
//       03-RESEARCH.md §Pattern 4 (lines 540-602);
//       03-RESEARCH.md §Code Examples §9 (lines 1258-1328);
//       03-RESEARCH.md §Pitfall 6 — worklet stale closure (use topRef);
//       03-PATTERNS.md §`app/(app)/groups/[id]/review.tsx` (lines 690-715).
//
// PER REVIEWS.md C3 (HIGH security — Mitigation B, defense in depth):
//   The screen MUST gate render on `isAdmin` BEFORE calling `useReviewQueue`
//   or rendering the queue UI. If `!isAdmin` (and group is loaded), redirect
//   silently to /groups/[id] — admin-ness should NOT be discoverable via
//   deep-link error states. `useReviewQueue` is also gated by
//   `isAdmin ? groupId : undefined` so non-admins do not even fire the RPC.
//   Combined with the C3 server-side `get_pending_review_queue` RPC gate
//   (Plan 03-02), the queue is unreachable to non-admins via either route.
//
// PER REVIEWS.md C5: SwipeCard's props mirror PendingSubmissionRow's
// snake_case shape, so `<SwipeCard {...row} />` works without a mapper
// (Plan 03-04 SwipeCard contract test locks this).
//
// PER REVIEWS.md C10: the Gesture.Pan() builder is wrapped in useMemo keyed
// on `top?.id` + callback identities so the gesture rebuilds when the top
// card identity changes (prevents worklet stale-closure binding to stale
// runOnJS callbacks during rapid swipes).

import { useState, useEffect, useCallback } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
// Swipe-stack gestures (Gesture.Pan + Reanimated SharedValues) were rescoped
// out during Phase 3 UAT — Approve/Reject buttons are now the only commit
// path. Phase 3.1 may revisit if real-world admins request swipe ergonomics.
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useReviewQueue } from '../../../../src/features/submissions/useReviewQueue';
import { useReviewSubmission } from '../../../../src/features/submissions/useReviewSubmission';
import { useGroup } from '../../../../src/features/groups/useGroup';
import { labelFor } from '../../../../src/features/groups/timezones';
import { useSession } from '../../../../src/features/auth/AuthProvider';
import {
  SwipeCard,
  PrimaryButton,
  GhostButton,
  DestructiveButton,
  Modal,
  ScreenContainer,
} from '../../../../src/components';
import { useTheme } from '../../../../src/theme/useTheme';

export default function ReviewQueueScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  // ── Admin gate (REVIEWS.md C3, Mitigation B) ───────────────────────────
  const { data: group, isPending: groupLoading } = useGroup(groupId);
  const isAdmin =
    !!user && !!group && group.admin_user_id === user.id;

  // Redirect non-admins silently. Wait until group is loaded for a
  // definitive answer — admin-ness should not flicker visible while loading.
  useEffect(() => {
    if (groupLoading || !group) return;
    if (!isAdmin) {
      router.replace(`/groups/${groupId}`);
    }
  }, [groupLoading, group, isAdmin, router, groupId]);

  // useReviewQueue is gated on isAdmin so non-admins do NOT fire the RPC.
  // Effective query enabled flag = !!groupId && isAdmin.
  const { data: pending, isPending: queueLoading } = useReviewQueue(
    isAdmin ? groupId : undefined,
  );
  const reviewMutation = useReviewSubmission(groupId);

  // Swipe gestures + reduced-motion handling were removed when the
  // gesture-stack was rescoped (see header comment). Buttons are the
  // only commit path — no animation-induced motion to gate.

  // ── First-review tooltip (UI-SPEC line 900) — 1-time per admin/device ──
  const [showTooltip, setShowTooltip] = useState(false);
  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    SecureStore.getItemAsync(`tooltip.admin_review.${user.id}`).then((v) => {
      if (!v) setShowTooltip(true);
    });
  }, [user?.id, isAdmin]);
  const dismissTooltip = useCallback(async () => {
    if (user?.id) {
      await SecureStore.setItemAsync(
        `tooltip.admin_review.${user.id}`,
        '1',
      );
    }
    setShowTooltip(false);
  }, [user?.id]);

  // ── Reject-reason panel + inline error toast state ─────────────────────
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  useEffect(() => {
    if (!errorToast) return;
    const i = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(i);
  }, [errorToast]);

  // ── Top-3 visible cards (visual stack only, no gestures) ───────────────
  const visibleCards = (pending ?? []).slice(0, 3);
  const top = visibleCards[0];

  // ── Approve / reject commit handlers ───────────────────────────────────
  const onApprove = useCallback(
    async (submissionId: string) => {
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        await reviewMutation.mutateAsync({
          submissionId,
          decision: 'approved',
          rejectionReason: null,
        });
        // Mutation invalidates ['reviewQueue', groupId] → next card renders
        // via the data-driven re-render.
      } catch {
        setErrorToast("Couldn't save that decision. Try again.");
      }
    },
    [reviewMutation],
  );

  const onRejectIntent = useCallback((submissionId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
    setRejectingId(submissionId);
    setRejectReason('');
  }, []);

  const onRejectCommit = useCallback(async () => {
    if (!rejectingId) return;
    try {
      await reviewMutation.mutateAsync({
        submissionId: rejectingId,
        decision: 'rejected',
        rejectionReason: rejectReason.length > 0 ? rejectReason : null,
      });
      setRejectingId(null);
      setRejectReason('');
    } catch {
      setErrorToast("Couldn't save that decision. Try again.");
    }
  }, [rejectingId, rejectReason, reviewMutation]);

  const onRejectCancel = useCallback(() => {
    setRejectingId(null);
    setRejectReason('');
  }, []);

  // ── Loading shell while group loads OR while non-admin redirect is in flight
  if (groupLoading || !group || !isAdmin) {
    return (
      <ScreenContainer>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Render NOTHING that hints "you are not admin" — admin-ness is
              undiscoverable. */}
        </View>
      </ScreenContainer>
    );
  }

  // ── Empty state (UI-SPEC line 899) ─────────────────────────────────────
  if (!queueLoading && (pending ?? []).length === 0) {
    return (
      <ScreenContainer>
        <ReviewHeader groupName={group.name} onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.spacing.xl,
            gap: t.spacing.lg,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: t.colors.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check" size={42} color="#FFFFFF" />
          </View>
          <Text
            accessibilityRole="header"
            style={[
              t.fonts.heading1,
              { color: t.colors.textStrong, textAlign: 'center' },
            ]}
          >
            All caught up
          </Text>
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.textMuted, textAlign: 'center' },
            ]}
          >
            Nothing's waiting on you.
          </Text>
          <View style={{ width: '100%', maxWidth: 320, marginTop: t.spacing.lg }}>
            <PrimaryButton label="Back to group" onPress={() => router.back()} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ── Loading state (3 skeleton cards) ───────────────────────────────────
  if (queueLoading || !top) {
    return (
      <ScreenContainer>
        <ReviewHeader groupName={group.name} onBack={() => router.back()} />
        <View style={{ flex: 1, paddingTop: t.spacing.lg }}>
          <View style={{ height: 360, position: 'relative' }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: '4%',
                  right: '4%',
                  top: i * 6,
                  height: 360 - i * 12,
                  backgroundColor: t.colors.surfaceMuted,
                  borderRadius: t.radii.lg,
                  opacity: 1 - i * 0.15,
                }}
              />
            ))}
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const firstName = (top.display_name ?? 'them').split(' ')[0];
  const tzLabel = labelFor(group.timezone ?? 'UTC');
  const pendingCount = pending?.length ?? 0;

  // ── Loaded state (CardStack + Action buttons + counter + reject panel) ─
  return (
    <ScreenContainer>
      <ReviewHeader groupName={group.name} onBack={() => router.back()} />

      <View style={{ flex: 1, paddingTop: t.spacing.lg }}>
        {/* CardStack — relative-positioned region for absolute cards. */}
        <View style={{ height: 360, position: 'relative' }}>
          {/* Card 3 (back) */}
          {visibleCards[2] ? (
            <SwipeCard
              {...visibleCards[2]}
              scale={0.94}
              translateY={12}
              zIndex={3}
            />
          ) : null}
          {/* Card 2 (middle) */}
          {visibleCards[1] ? (
            <SwipeCard
              {...visibleCards[1]}
              scale={0.97}
              translateY={6}
              zIndex={4}
            />
          ) : null}
          {/* Card 1 (TOP — full size, static; commit via Approve/Reject buttons below) */}
          {top ? (
            <SwipeCard
              {...top}
              scale={1}
              translateY={0}
              zIndex={5}
            />
          ) : null}
        </View>

        {/* Inline error toast (UI-SPEC line 898) — docked above the buttons. */}
        {errorToast ? (
          <View
            accessibilityRole="alert"
            style={{
              marginHorizontal: t.spacing.xl,
              marginTop: t.spacing.lg,
              paddingVertical: t.spacing.sm,
              paddingHorizontal: t.spacing.md,
              backgroundColor: `${t.colors.destructive}26`,
              borderRadius: t.radii.sm,
            }}
          >
            <Text
              style={[
                t.fonts.caption,
                { color: t.colors.destructive, fontWeight: '700' },
              ]}
            >
              {errorToast}
            </Text>
          </View>
        ) : null}

        {/* Action buttons row (UI-SPEC line 882, lines 970-971) — */}
        {/* hidden when reject-reason panel is open. */}
        {!rejectingId ? (
          <View
            style={{
              flexDirection: 'row',
              gap: t.spacing.md,
              paddingHorizontal: t.spacing.xl,
              marginTop: t.spacing['2xl'],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reject submission from ${
                top.display_name ?? 'member'
              }`}
              accessibilityHint="Today won't count and they can't resubmit"
              onPress={() => onRejectIntent(top.id)}
              style={{
                flex: 1,
                height: 52,
                borderRadius: t.radii.md,
                borderWidth: 2,
                borderColor: t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: t.spacing.sm,
              }}
            >
              <Feather name="x" size={18} color={t.colors.text} />
              <Text
                style={[
                  t.fonts.body,
                  { color: t.colors.text, fontWeight: '700' },
                ]}
              >
                Reject
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Approve"
                onPress={() => onApprove(top.id)}
                accessibilityLabel={`Approve submission from ${
                  top.display_name ?? 'member'
                }`}
              />
            </View>
          </View>
        ) : null}

        {/* Pending counter (UI-SPEC line 883) */}
        {!rejectingId && pendingCount > 0 ? (
          <Text
            style={[
              t.fonts.caption,
              {
                color: t.colors.textMuted,
                fontWeight: '500',
                textAlign: 'center',
                marginTop: t.spacing.lg,
              },
            ]}
          >
            {`${pendingCount} pending in this group`}
          </Text>
        ) : null}

        {/* Reject-reason panel (UI-SPEC §Reject-reason panel lines 902-917) */}
        {rejectingId ? (
          <View
            style={{
              paddingHorizontal: t.spacing.xl,
              marginTop: t.spacing.md,
              gap: t.spacing.md,
            }}
          >
            <Text
              style={[
                t.fonts.caption,
                { color: t.colors.textStrong, fontWeight: '700' },
              ]}
            >
              {`Tell ${firstName} what's off (optional)`}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.sm,
                backgroundColor: t.colors.surface,
                borderWidth: 2,
                borderColor: t.colors.accent,
                borderRadius: t.radii.md,
                paddingHorizontal: t.spacing.lg,
                height: 52,
              }}
            >
              <TextInput
                accessibilityLabel="Optional rejection reason"
                value={rejectReason}
                onChangeText={setRejectReason}
                maxLength={140}
                placeholder="e.g. that's not today's run"
                placeholderTextColor={t.colors.textMuted}
                style={[
                  t.fonts.body,
                  {
                    flex: 1,
                    color: t.colors.text,
                    fontWeight: '500',
                  },
                ]}
                numberOfLines={1}
              />
              <Text
                style={[
                  t.fonts.caption,
                  {
                    color: t.colors.textMuted,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {`${rejectReason.length}/140`}
              </Text>
            </View>

            <View
              accessibilityRole="alert"
              style={{
                backgroundColor: t.colors.surfaceMuted,
                borderWidth: 1,
                borderColor: t.colors.border,
                borderRadius: t.radii.md,
                padding: t.spacing.lg,
                flexDirection: 'row',
                gap: t.spacing.md,
              }}
            >
              <Feather
                name="alert-triangle"
                size={18}
                color={t.colors.text}
              />
              <Text
                style={[
                  t.fonts.body,
                  { color: t.colors.text, fontWeight: '500', flex: 1 },
                ]}
              >
                {`This rejection is final for today — ${firstName} can't resubmit. Streak resets at midnight in ${tzLabel}.`}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
              <View style={{ flex: 1 }}>
                <GhostButton label="Never mind" onPress={onRejectCancel} />
              </View>
              <View style={{ flex: 1 }}>
                <DestructiveButton
                  label="Reject"
                  onPress={onRejectCommit}
                  loading={reviewMutation.isPending}
                  accessibilityLabel={`Reject submission from ${firstName}`}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* First-review tooltip (UI-SPEC §First-review tooltip lines 424-432) */}
      {/* Single-exit modal: 'Got it' replaces both primary+cancel via the */}
      {/* P2 Modal API (UI-SPEC line 432 — single-action). */}
      <Modal
        visible={showTooltip}
        onDismiss={dismissTooltip}
        title="How review works"
        body={
          <View style={{ gap: t.spacing.md }}>
            {(
              [
                {
                  color: t.colors.success,
                  icon: 'check' as const,
                  text: 'Swipe right or tap Approve — the submission counts.',
                },
                {
                  color: t.colors.destructive,
                  icon: 'x' as const,
                  text:
                    "Swipe left or tap Reject — today won't count for that member. They can't resubmit.",
                },
                {
                  color: t.colors.primary,
                  icon: 'edit-2' as const,
                  text:
                    "Add an optional one-line note when you reject so they know what's off.",
                },
              ] as const
            ).map((b, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  gap: t.spacing.md,
                  alignItems: 'flex-start',
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: b.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather
                    name={b.icon}
                    size={14}
                    color={
                      b.color === t.colors.primary ? t.colors.primaryFg : '#FFFFFF'
                    }
                  />
                </View>
                <Text
                  style={[
                    t.fonts.body,
                    { flex: 1, color: t.colors.text },
                  ]}
                >
                  {b.text}
                </Text>
              </View>
            ))}
          </View>
        }
        primaryAction={{
          label: 'Got it',
          variant: 'primary',
          onPress: dismissTooltip,
        }}
        // Required by Modal API; the tooltip is a single-exit modal so we
        // re-use the primary action's label here. Dev-warning enforces non-
        // 'Cancel' text — 'Got it' satisfies that.
        cancelLabel="Got it"
      />
    </ScreenContainer>
  );
}

// ── ReviewHeader — back chevron + "Pending review" + group name caption ──
function ReviewHeader({
  groupName,
  onBack,
}: {
  groupName: string;
  onBack: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: t.spacing.xs,
        paddingBottom: t.spacing.sm,
        gap: t.spacing.xs,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to group"
        hitSlop={8}
        onPress={onBack}
        style={{
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: t.radii.pill,
        }}
      >
        <Feather name="chevron-left" size={24} color={t.colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          style={[
            t.fonts.heading2,
            { color: t.colors.textStrong, fontWeight: '700' },
          ]}
        >
          Pending review
        </Text>
        <Text
          style={[
            t.fonts.caption,
            { color: t.colors.textMuted, fontWeight: '500' },
          ]}
        >
          {groupName}
        </Text>
      </View>
      <View style={{ width: 10 }} />
    </View>
  );
}
