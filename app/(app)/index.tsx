// Today screen — the primary daily surface (Phase 3 / Plan 03-06).
// Spec: 03-UI-SPEC.md §"Today screen" (lines 734-783); §"Rejected-pill tap modal"
// (lines 419-422); §QueueBadge bottom-sheet (lines 540-550).
//
// Anatomy:
//   • Header: "Today" Display/800 + weekday-and-date subtitle
//   • Populated state: FlatList of GroupCard rows with pull-to-refresh
//   • Empty state: "No groups yet" + Create-a-group + Join-with-a-code link
//   • Loading state: 3 GroupCard-shaped skeleton blocks
//
// Realtime: useTodaySubmissionRealtime(user.id, getGroupTzs) at screen scope.
// PER REVIEWS C1, getGroupTzs is a useCallback-stable function returning a
// fresh Map<groupId, timezone> so the Realtime handler can compute today's
// local-date per group and reject yesterday/tomorrow events that would
// otherwise pollute the today cache.
//
// Per-group hook calls (useTodaySubmission, useUploadQueue, cutoffStateFor)
// are made INSIDE the GroupCardRow inner component — FlatList instantiates one
// per row, so hooks are called in a fixed order per row instance, satisfying
// the Rules of Hooks.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useGroupsList, type GroupsListRow } from '../../src/features/groups/useGroupsList';
import { useSession } from '../../src/features/auth/AuthProvider';
import { useTodaySubmission } from '../../src/features/submissions/useTodaySubmission';
import { useUploadQueue } from '../../src/features/submissions/useUploadQueue';
import { useTodaySubmissionRealtime } from '../../src/features/submissions/useTodaySubmissionRealtime';
import {
  cutoffStateFor,
  submittedAgoLabel,
  todayLocalDate,
} from '../../src/features/submissions/time';
import { dequeue, readQueue, flushQueue } from '../../src/features/submissions/uploadQueueManager';
import { useTheme } from '../../src/theme/useTheme';
import {
  GroupCard,
  Modal,
  PrimaryButton,
  ScreenContainer,
} from '../../src/components';

export default function TodayScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, session } = useSession();
  const qc = useQueryClient();
  const {
    data: groups,
    isPending,
    isFetching,
    refetch,
  } = useGroupsList();

  // PER REVIEWS C1: stable callback that returns the latest tz map. The
  // Realtime hook reads via getGroupTzs() inside its handler, so a recompute
  // when groups changes is fine — we don't want to re-subscribe on every
  // render, but we do want the latest tz lookup.
  const getGroupTzs = useCallback(
    () => new Map((groups ?? []).map((g) => [g.id, g.timezone])),
    [groups],
  );

  // Realtime subscription — single channel filtered server-side on user_id.
  // useFocusEffect inside the hook handles tab-blur teardown (Pitfall 11).
  useTodaySubmissionRealtime(user?.id, getGroupTzs);

  // Modal state — one per affordance.
  type RejectionModalState = {
    open: boolean;
    rejectionReason: string | null;
  };
  const [rejectionModal, setRejectionModal] = useState<RejectionModalState>({
    open: false,
    rejectionReason: null,
  });
  const openRejectionModal = (reason: string | null) =>
    setRejectionModal({ open: true, rejectionReason: reason });

  const [queueSheetGroupId, setQueueSheetGroupId] = useState<string | null>(
    null,
  );

  const todayHeader = useMemo(() => formatTodayHeader(new Date()), []);

  // ── Loading state ────────────────────────────────────────────────
  if (isPending) {
    return (
      <ScreenContainer>
        <TodayHeader t={t} subtitle={todayHeader} />
        <TodaySkeleton />
      </ScreenContainer>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────
  const isEmpty = !groups || groups.length === 0;
  if (isEmpty) {
    return (
      <ScreenContainer>
        <TodayHeader t={t} subtitle={todayHeader} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.spacing.xl,
          }}
        >
          <Text
            style={[
              t.fonts.heading1,
              { color: t.colors.text, textAlign: 'center' },
            ]}
          >
            No groups yet
          </Text>
          <Text
            style={[
              t.fonts.body,
              {
                color: t.colors.textMuted,
                textAlign: 'center',
                marginTop: t.spacing.sm,
              },
            ]}
          >
            Create one with friends or join one with a code.
          </Text>
          <View
            style={{
              marginTop: t.spacing['2xl'],
              maxWidth: 320,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <View style={{ width: '100%' }}>
              <PrimaryButton
                label="Create a group"
                onPress={() => router.push('/groups/new')}
              />
            </View>
            <Pressable
              onPress={() => router.push('/groups/join')}
              accessibilityRole="link"
              accessibilityLabel="Join with a code"
              style={({ pressed }) => ({
                marginTop: t.spacing.md,
                opacity: pressed ? 0.7 : 1,
                paddingVertical: t.spacing.sm,
              })}
            >
              <Text
                style={[
                  t.fonts.body,
                  { color: t.colors.accent, fontWeight: '700' },
                ]}
              >
                Join with a code
              </Text>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ── Populated state ──────────────────────────────────────────────
  return (
    <ScreenContainer>
      <TodayHeader t={t} subtitle={todayHeader} />
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GroupCardRow
            group={item}
            onSubmitPress={() => router.push(`/capture/${item.id}`)}
            onRejectedPillPress={(reason) => openRejectionModal(reason)}
            onQueueBadgeMorePress={() => setQueueSheetGroupId(item.id)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: t.spacing.lg }} />
        )}
        contentContainerStyle={{
          paddingTop: t.spacing.lg,
          paddingHorizontal: t.spacing.md,
          paddingBottom: t.spacing['2xl'],
        }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={t.colors.textMuted}
            accessibilityHint="Refreshes today's status for all your groups"
          />
        }
      />

      {/* Why-it-didn't-count modal — opened by GroupCard rejected-pill tap. */}
      <Modal
        visible={rejectionModal.open}
        onDismiss={() =>
          setRejectionModal({ open: false, rejectionReason: null })
        }
        title="Why it didn't count"
        body={
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.text, textAlign: 'center' },
            ]}
          >
            {rejectionModal.rejectionReason
              ? `Your admin said: "${rejectionModal.rejectionReason}"`
              : 'No reason given.'}
          </Text>
        }
        primaryAction={{
          label: 'Got it',
          onPress: () =>
            setRejectionModal({ open: false, rejectionReason: null }),
          variant: 'primary',
        }}
        cancelLabel="Got it"
      />

      {/* Queue bottom-sheet — opened by GroupCard QueueBadge more tap. */}
      <QueueBottomSheet
        groupId={queueSheetGroupId}
        onClose={() => setQueueSheetGroupId(null)}
        onMutate={() => qc.invalidateQueries({ queryKey: ['uploadQueue'] })}
        getSession={() => session}
      />
    </ScreenContainer>
  );
}

// ────────────────────────────────────────────────────────────────────
// Header

function TodayHeader({
  t,
  subtitle,
}: {
  t: ReturnType<typeof useTheme>;
  subtitle: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: t.spacing.xl,
        paddingTop: t.spacing.md,
        paddingBottom: t.spacing.lg,
      }}
    >
      <Text
        style={[t.fonts.display, { color: t.colors.textStrong }]}
      >
        Today
      </Text>
      <Text
        style={[
          t.fonts.body,
          { color: t.colors.textMuted, marginTop: t.spacing.sm },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Per-row component — calls per-group hooks in a fixed order per instance.

function GroupCardRow({
  group,
  onSubmitPress,
  onRejectedPillPress,
  onQueueBadgeMorePress,
}: {
  group: GroupsListRow;
  onSubmitPress: () => void;
  onRejectedPillPress: (rejectionReason: string | null) => void;
  onQueueBadgeMorePress: () => void;
}) {
  const today = useMemo(
    () => todayLocalDate(group.timezone, new Date()),
    [group.timezone],
  );
  const { data: submission } = useTodaySubmission(group.id, today);
  const { data: queueMap } = useUploadQueue();
  const queueSummary = queueMap?.get(group.id);

  const cutoff = useMemo(
    () => cutoffStateFor({ timezone: group.timezone }),
    [group.timezone],
  );

  const status: 'none' | 'pending' | 'approved' | 'rejected' =
    submission?.status ?? 'none';
  const submittedAgo = submission
    ? (submittedAgoLabel(submission.created_at) ?? undefined)
    : undefined;

  return (
    <GroupCard
      groupId={group.id}
      name={group.name}
      goal={group.goal}
      kind={group.submission_type}
      status={status}
      cutoffTime={status === 'none' ? cutoff.cutoffTime : undefined}
      minutesLeft={status === 'none' ? cutoff.minutesLeft : undefined}
      submittedAgo={
        status === 'pending' || status === 'approved'
          ? submittedAgo
          : undefined
      }
      rejectionReason={submission?.rejection_reason ?? null}
      queuedUploadSize={queueSummary?.sizeLabel}
      onSubmitPress={onSubmitPress}
      onRejectedPillPress={
        submission?.rejection_reason || status === 'rejected'
          ? () => onRejectedPillPress(submission?.rejection_reason ?? null)
          : undefined
      }
      onQueueBadgeMorePress={onQueueBadgeMorePress}
    />
  );
}

// ────────────────────────────────────────────────────────────────────
// Skeleton — 3 GroupCard-shaped blocks.

function TodaySkeleton() {
  const t = useTheme();
  return (
    <View
      style={{
        paddingTop: t.spacing.lg,
        paddingHorizontal: t.spacing.md,
        gap: t.spacing.lg,
      }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: 196,
            borderRadius: t.radii.md,
            backgroundColor: t.colors.surfaceMuted,
          }}
        />
      ))}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// QueueBottomSheet — pageSheet Modal listing pending uploads for a group.
// Reuses the existing P2 RNModal directly (presentationStyle="pageSheet")
// because the shared Modal primitive only supports a single primaryAction
// and a single secondaryAction — not a per-entry list of actions.

function QueueBottomSheet({
  groupId,
  onClose,
  onMutate,
  getSession,
}: {
  groupId: string | null;
  onClose: () => void;
  onMutate: () => void;
  getSession: () => import('@supabase/supabase-js').Session | null;
}) {
  const t = useTheme();
  const [entries, setEntries] = useState<
    | null
    | {
        client_uuid: string;
        media_type: 'photo' | 'video';
        created_at_iso: string;
      }[]
  >(null);
  const [working, setWorking] = useState(false);

  const visible = groupId !== null;

  // Re-read the queue whenever the sheet opens for a given groupId.
  useEffect(() => {
    let alive = true;
    if (!visible || !groupId) {
      setEntries(null);
      return;
    }
    void readQueue().then((all) => {
      if (!alive) return;
      setEntries(
        all
          .filter((e) => e.group_id === groupId)
          .map((e) => ({
            client_uuid: e.client_uuid,
            media_type: e.media_type,
            created_at_iso: e.created_at_iso,
          })),
      );
    });
    return () => {
      alive = false;
    };
  }, [visible, groupId]);

  const onDiscard = async (clientUuid: string) => {
    setWorking(true);
    try {
      await dequeue(clientUuid);
      onMutate();
      // Remove from local list without re-reading.
      setEntries((cur) =>
        cur ? cur.filter((e) => e.client_uuid !== clientUuid) : cur,
      );
    } finally {
      setWorking(false);
    }
  };

  const onRetryAll = async () => {
    setWorking(true);
    try {
      await flushQueue(getSession());
      onMutate();
      // Re-read so the list reflects what flushQueue dropped vs. retained.
      if (groupId) {
        const all = await readQueue();
        setEntries(
          all
            .filter((e) => e.group_id === groupId)
            .map((e) => ({
              client_uuid: e.client_uuid,
              media_type: e.media_type,
              created_at_iso: e.created_at_iso,
            })),
        );
      }
    } finally {
      setWorking(false);
    }
  };

  // Use the shared Modal with a single Retry-all primary action; per-entry
  // Discard buttons live inside the body so we don't need a custom shell.
  return (
    <Modal
      visible={visible}
      onDismiss={onClose}
      title="Pending uploads"
      body={
        <View style={{ gap: t.spacing.md }}>
          {entries === null ? (
            <Text
              style={[
                t.fonts.body,
                { color: t.colors.textMuted, textAlign: 'center' },
              ]}
            >
              Loading…
            </Text>
          ) : entries.length === 0 ? (
            <Text
              style={[
                t.fonts.body,
                { color: t.colors.textMuted, textAlign: 'center' },
              ]}
            >
              Nothing queued.
            </Text>
          ) : (
            entries.map((e) => (
              <View
                key={e.client_uuid}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: t.spacing.md,
                  paddingVertical: t.spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[t.fonts.body, { color: t.colors.text }]}
                    numberOfLines={1}
                  >
                    {e.media_type === 'photo' ? 'Photo' : 'Video'} ·{' '}
                    {new Date(e.created_at_iso).toLocaleTimeString()}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Discard upload"
                  disabled={working}
                  onPress={() => onDiscard(e.client_uuid)}
                  style={({ pressed }) => ({
                    paddingVertical: t.spacing.xs,
                    paddingHorizontal: t.spacing.md,
                    opacity: pressed || working ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={[
                      t.fonts.body,
                      { color: t.colors.destructive, fontWeight: '600' },
                    ]}
                  >
                    Discard
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      }
      primaryAction={{
        label: 'Retry now',
        onPress: onRetryAll,
        variant: 'primary',
        loading: working,
      }}
      cancelLabel="Done"
    />
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers

function formatTodayHeader(now: Date): string {
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const month = now.toLocaleDateString(undefined, { month: 'short' });
  const day = now.getDate();
  return `${weekday}, ${month} ${day}`;
}
