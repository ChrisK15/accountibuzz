// GroupCard — Today screen per-group composite card.
// Spec: 03-UI-SPEC.md §3 GroupCard (lines 493-538) + §State Matrix (lines 982-993)
//       + §Cutoff hint copy (lines 346-357).
//
// Anatomy: 5-row vertical stack
//   ROW 1: name (heading2-700) + StatusPill (right-aligned)
//   ROW 2: goal (body-500, 2-line truncate) + TypeChip (right)
//   ROW 3: cutoff hint OR submittedAgo (caption-500, urgency-coloured)
//   ROW 4: status-driven CTA (PrimaryButton / SecondaryButton / GhostButton)
//   ROW 5 (conditional): inline QueueBadge — separated by 1px top border + md
//          top-padding. Renders only when queuedUploadSize is truthy.
//
// Realtime cross-fade: when status prop changes, fade the StatusPill + CTA
// opacity 1→0 (125ms) then 0→1 (125ms). NOT a spring (UI-SPEC line 946).
//
// QueueBadge is built inline (not extracted) per UI-SPEC line 1106.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { GhostButton } from './GhostButton';
import { StatusPill } from './StatusPill';
import { TypeChip } from './TypeChip';

export interface GroupCardProps {
  groupId: string;
  name: string;
  goal: string;
  kind: 'photo' | 'video';
  status: 'none' | 'pending' | 'approved' | 'rejected';
  cutoffTime?: string;
  minutesLeft?: number;
  submittedAgo?: string;
  rejectionReason?: string | null;
  /** e.g. "2.4 MB" — undefined when no queued upload. */
  queuedUploadSize?: string;
  onSubmitPress: () => void;
  onRejectedPillPress?: () => void;
  onQueueBadgeMorePress?: () => void;
}

function compositeA11yLabel(args: {
  name: string;
  kind: 'photo' | 'video';
  status: GroupCardProps['status'];
  cutoffTime?: string;
  minutesLeft?: number;
  submittedAgo?: string;
}): string {
  const kindLabel = args.kind === 'photo' ? 'photo group' : 'video group';
  const statusLabel =
    args.status === 'none'
      ? 'no submission yet'
      : args.status === 'pending'
        ? 'pending review'
        : args.status === 'approved'
          ? 'approved'
          : "today didn't count";
  let trailing = '';
  if (args.status === 'none' && args.cutoffTime && args.minutesLeft != null) {
    trailing = `, ${args.cutoffTime} cutoff, ${formatTimeLeft(args.minutesLeft)} left`;
  } else if (args.submittedAgo && args.status !== 'rejected') {
    trailing = `, submitted ${args.submittedAgo}`;
  }
  return `${args.name} group, ${kindLabel}, ${statusLabel}${trailing}`;
}

function formatTimeLeft(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  return `${h}h`;
}

function urgencyTextStyle(
  minutesLeft: number,
  destructive: string,
  muted: string,
): { color: string; weight: '500' | '700' } {
  if (minutesLeft < 5) return { color: destructive, weight: '700' };
  if (minutesLeft < 60) return { color: destructive, weight: '500' };
  return { color: muted, weight: '500' };
}

interface InlineQueueBadgeProps {
  queuedUploadSize: string;
  onMorePress?: () => void;
}

function InlineQueueBadge({
  queuedUploadSize,
  onMorePress,
}: InlineQueueBadgeProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Upload pending — ${queuedUploadSize} queued`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        marginTop: t.spacing.md,
        paddingTop: t.spacing.md,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
      }}
    >
      <Feather name="upload-cloud" size={16} color={t.colors.textMuted} />
      <Text
        style={[
          t.fonts.caption,
          { color: t.colors.textMuted, fontWeight: '500', flex: 1 },
        ]}
        numberOfLines={1}
      >
        {`Upload pending — ${queuedUploadSize} queued`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More options for this upload"
        onPress={onMorePress}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Feather
          name="more-horizontal"
          size={18}
          color={t.colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

export function GroupCard({
  groupId: _groupId,
  name,
  goal,
  kind,
  status,
  cutoffTime,
  minutesLeft,
  submittedAgo,
  rejectionReason: _rejectionReason,
  queuedUploadSize,
  onSubmitPress,
  onRejectedPillPress,
  onQueueBadgeMorePress,
}: GroupCardProps) {
  const t = useTheme();

  // Realtime cross-fade on status change — UI-SPEC line 536. 125ms out / 125ms in.
  const opacity = useRef(new Animated.Value(1)).current;
  // Skip the very first render so initial mount doesn't flicker.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 125,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 125,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, opacity]);

  // ROW 3 content: cutoff hint OR submittedAgo OR (rejected — hidden).
  let row3: React.ReactNode = null;
  if (status === 'none' && cutoffTime) {
    const ml = minutesLeft ?? 9999;
    const { color, weight } = urgencyTextStyle(
      ml,
      t.colors.destructive,
      t.colors.textMuted,
    );
    row3 = (
      <Text style={[t.fonts.caption, { color, fontWeight: weight }]}>
        {`${cutoffTime} cutoff (${formatTimeLeft(ml)} left)`}
      </Text>
    );
  } else if (status !== 'rejected' && submittedAgo) {
    row3 = (
      <Text
        style={[
          t.fonts.caption,
          { color: t.colors.textMuted, fontWeight: '500' },
        ]}
      >
        {`Submitted ${submittedAgo}`}
      </Text>
    );
  }

  // ROW 4 content: status-driven CTA.
  const submitLabel = kind === 'photo' ? 'Submit photo' : 'Submit video';
  let cta: React.ReactNode;
  if (status === 'none') {
    cta = (
      <PrimaryButton
        label={submitLabel}
        onPress={onSubmitPress}
        accessibilityLabel={submitLabel}
      />
    );
  } else if (status === 'pending' || status === 'approved') {
    cta = (
      <SecondaryButton
        label="Submitted"
        onPress={() => {}}
        disabled
        accessibilityLabel="Submitted"
      />
    );
  } else {
    // status === 'rejected' — GhostButton with destructive 4px left-border accent.
    cta = (
      <View>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: t.colors.destructive,
            borderTopLeftRadius: t.radii.md,
            borderBottomLeftRadius: t.radii.md,
          }}
        />
        <GhostButton
          label="Today didn't count"
          onPress={() => {}}
          disabled
          accessibilityLabel="Today didn't count"
        />
      </View>
    );
  }

  const a11yLabel = compositeA11yLabel({
    name,
    kind,
    status,
    cutoffTime,
    minutesLeft,
    submittedAgo,
  });

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      style={{
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        padding: t.spacing.lg,
      }}
    >
      {/* ROW 1: name + StatusPill (cross-fades on status change) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: t.spacing.md,
        }}
      >
        <Text
          style={[
            t.fonts.heading2,
            { color: t.colors.textStrong, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Animated.View style={{ opacity }}>
          <StatusPill
            status={status}
            onPress={status === 'rejected' ? onRejectedPillPress : undefined}
          />
        </Animated.View>
      </View>

      {/* ROW 2: goal (truncate to 2 lines) + TypeChip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: t.spacing.md,
          marginTop: t.spacing.xs,
        }}
      >
        <Text
          style={[
            t.fonts.body,
            { color: t.colors.text, fontWeight: '500', flex: 1 },
          ]}
          numberOfLines={2}
        >
          {goal}
        </Text>
        <TypeChip kind={kind} />
      </View>

      {/* ROW 3: cutoff hint or submittedAgo (hidden in rejected state) */}
      {row3 && <View style={{ marginTop: t.spacing.md }}>{row3}</View>}

      {/* ROW 4: status-driven CTA, cross-fades on status change */}
      <Animated.View style={{ marginTop: t.spacing.lg, opacity }}>
        {cta}
      </Animated.View>

      {/* ROW 5: inline QueueBadge — only when queuedUploadSize truthy */}
      {queuedUploadSize ? (
        <InlineQueueBadge
          queuedUploadSize={queuedUploadSize}
          onMorePress={onQueueBadgeMorePress}
        />
      ) : null}
    </View>
  );
}
