// LeaderboardRow — composed row with rank chip, avatar, name, meta, points.
// Spec: 04-UI-SPEC.md §"Component Additions §1 LeaderboardRow" (lines 458-505)
//       + Typography §Locked Exception (lines 132-141: 800-on-Heading-2 for points)
//       + Color §Primary Reserved-For List (lines 197-203: rank-1 = primary).
//
// Anatomy:
//   Row (h=56, px=lg, gap=md, items-center):
//     [RankChip 24×24] [Avatar 36] [flex column: name + meta] [right column: points + 'pts']
//
// RankChip variants:
//   rank === 1   → 24×24 pill, --primary bg, --primary-fg numeral
//   rank === 2|3 → 24×24 pill, --surface-muted bg, --text numeral
//   rank >= 4    → bare numeral in --text-muted (24×24 hit-slot for layout)
//   rank === 0   → 24×24 spacer (empty-state mode)
//
// Render-only in this plan; cross-fade animations + reduceMotion prop come in
// 04-05 Task 3 (LeaderboardRow patch). NOT tappable in P4.

import { Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { useTheme } from '../../theme/useTheme';

export interface LeaderboardRowProps {
  /** 1-based; 0 indicates empty-state row (no chip). */
  rank: number;
  userId: string;
  /** Caller pre-computes via `entry.user_id === auth.user.id`. */
  isYou: boolean;
  displayName: string;
  /** Resolved public URL (with WR-01 ?v={updated_at} cache-bust). */
  avatarUrl?: string | null;
  points: number;
  currentStreak: number;
  /** ISO date — caller can pass for future use; renderer ignores. */
  joinedAt?: string | null;
  /** Pre-formatted by caller (e.g. "Apr 3"). When provided, appended to meta. */
  joinedLabel?: string;
}

interface RankChipProps {
  rank: number;
  primary: string;
  primaryFg: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
}

function RankChip({
  rank,
  primary,
  primaryFg,
  surfaceMuted,
  text,
  textMuted,
}: RankChipProps) {
  // Empty-state spacer.
  if (rank === 0) {
    return <View style={{ width: 24, height: 24 }} />;
  }
  // Bare numeral for rank >= 4.
  if (rank >= 4) {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope_700Bold',
            fontSize: 13,
            lineHeight: 18,
            color: textMuted,
            fontVariant: ['tabular-nums'],
          }}
        >
          {String(rank)}
        </Text>
      </View>
    );
  }
  const isFirst = rank === 1;
  const bg = isFirst ? primary : surfaceMuted;
  const fg = isFirst ? primaryFg : text;
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: 'Manrope_700Bold',
          fontSize: 13,
          lineHeight: 18,
          color: fg,
          fontVariant: ['tabular-nums'],
        }}
      >
        {String(rank)}
      </Text>
    </View>
  );
}

function compositeA11yLabel(args: {
  rank: number;
  displayName: string;
  isYou: boolean;
  points: number;
  currentStreak: number;
}): string {
  const youSuffix = args.isYou ? ' (you)' : '';
  if (args.rank === 0) {
    return `Unranked, ${args.displayName}${youSuffix}, ${args.points} points`;
  }
  return `Rank ${args.rank}, ${args.displayName}${youSuffix}, ${args.points} points, ${args.currentStreak}-day streak`;
}

export function LeaderboardRow({
  rank,
  userId: _userId,
  isYou,
  displayName,
  avatarUrl,
  points,
  currentStreak,
  joinedLabel,
}: LeaderboardRowProps) {
  const t = useTheme();

  const a11yLabel = compositeA11yLabel({
    rank,
    displayName,
    isYou,
    points,
    currentStreak,
  });

  // Per UI-SPEC §Empty Behavior (line 493): empty-state row mutes the points number.
  const pointsColor = rank === 0 ? t.colors.textMuted : t.colors.text;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={{
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: t.spacing.lg,
        gap: t.spacing.md,
      }}
    >
      <RankChip
        rank={rank}
        primary={t.colors.primary}
        primaryFg={t.colors.primaryFg}
        surfaceMuted={t.colors.surfaceMuted}
        text={t.colors.text}
        textMuted={t.colors.textMuted}
      />
      <Avatar size={36} name={displayName} imageUri={avatarUrl ?? null} />

      {/* Middle column: name (with optional "(you)" appendix) + meta line */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.text, fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {isYou ? (
            <Text
              style={[
                t.fonts.body,
                {
                  color: t.colors.textMuted,
                  fontWeight: '500',
                  marginLeft: t.spacing.xs,
                },
              ]}
            >
              (you)
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            t.fonts.caption,
            {
              color: t.colors.textMuted,
              fontWeight: '500',
              fontVariant: ['tabular-nums'],
              marginTop: 2,
            },
          ]}
        >
          {`🔥${currentStreak}${joinedLabel ? ` · joined ${joinedLabel}` : ''}`}
        </Text>
      </View>

      {/* Right column: points (Heading-2/800) + "pts" caption */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'Manrope_800ExtraBold',
            fontSize: 20,
            lineHeight: 26,
            color: pointsColor,
            fontVariant: ['tabular-nums'],
            // 800-on-Heading-2 — UI-SPEC Locked Exception §1 (Typography).
            fontWeight: '800',
          }}
        >
          {String(points)}
        </Text>
        <Text
          style={[
            t.fonts.caption,
            { color: t.colors.textMuted, fontWeight: '500' },
          ]}
        >
          pts
        </Text>
      </View>
    </View>
  );
}
