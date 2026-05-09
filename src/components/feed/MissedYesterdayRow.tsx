// MissedYesterdayRow — quiet tombstone surface for FEED-03.
// Spec: 04-UI-SPEC.md §"Component Additions §4 MissedYesterdayTombstones"
//       (lines 598-630) + Copywriting Contract "Missed yesterday" (lines 361-374).
//
// Anatomy:
//   <View role=text> (composite a11y label)
//     <View backgroundColor=hsla(...) padding=md radius=md>
//       flex-wrap row of: [28pt Avatar opacity 0.7] {displayName} ·
//     <Text> Streaks reset at 12:00 AM {tzShortLabel}.
//
// HIGH #5 (REVIEWS replan 2026-05-08): backgroundColor uses applyAlpha
// because tokens are `hsl(...)` strings. The naive `surfaceMuted + '66'`
// idiom yields invalid CSS (`hsl(220, 14%, 92%)66`).
//
// Tone discipline (CONTEXT D-08, UI-SPEC §Color §Destructive Reserved-For
// List): NEVER uses `t.colors.destructive`. Surface-muted/40 + text-muted
// only. Avatar opacity 0.7 (Lovable's grayscale-[.5] is dropped per Token
// Mapping note).

import { Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { applyAlpha } from '../../theme/applyAlpha';
import { useTheme } from '../../theme/useTheme';

export interface MissedMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface MissedYesterdayRowProps {
  members: MissedMember[];
  /** Short tz label, e.g. "PT" / "ET" — used in the trailing copy. */
  tzShortLabel: string;
}

function compositeA11yLabel(
  members: MissedMember[],
  tzShortLabel: string,
): string {
  const noun = members.length === 1 ? 'member' : 'members';
  const allNames = members.map((m) => m.displayName).join(', ');
  return `${members.length} ${noun} missed yesterday: ${allNames}. Streaks reset at 12:00 AM ${tzShortLabel}.`;
}

export function MissedYesterdayRow({
  members,
  tzShortLabel,
}: MissedYesterdayRowProps) {
  const t = useTheme();

  // Per UI-SPEC §Missed-yesterday state matrix line 853: 0 missers → section absent.
  if (members.length === 0) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={compositeA11yLabel(members, tzShortLabel)}
    >
      {/* Surface-muted/40 container — HIGH #5: applyAlpha (not the broken hex-suffix concat). */}
      <View
        style={{
          backgroundColor: applyAlpha(t.colors.surfaceMuted, 0.4),
          borderRadius: t.radii.md,
          padding: t.spacing.md,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: t.spacing.md,
          rowGap: t.spacing.sm,
        }}
      >
        {members.map((m, index) => {
          const isLast = index === members.length - 1;
          return (
            <View
              key={m.userId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6, // 6pt = xs * 1.5; no exact token (UI-SPEC §gap-1.5).
              }}
            >
              {/* 28pt Avatar — Locked Exception §1 — at opacity 0.7 */}
              <View style={{ opacity: 0.7 }}>
                <Avatar
                  size={28}
                  name={m.displayName}
                  imageUri={m.avatarUrl ?? null}
                />
              </View>
              <Text
                style={[
                  t.fonts.body,
                  {
                    color: t.colors.textMuted,
                    fontWeight: '500',
                  },
                ]}
              >
                {m.displayName}
              </Text>
              {!isLast ? (
                <Text
                  style={[
                    t.fonts.body,
                    {
                      color: t.colors.textMuted,
                      fontWeight: '500',
                      marginLeft: t.spacing.sm,
                    },
                  ]}
                >
                  ·
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Trailing tz copy — UI-SPEC line 163 */}
      <Text
        style={[
          t.fonts.caption,
          {
            color: t.colors.textMuted,
            fontWeight: '500',
            marginTop: t.spacing.sm,
          },
        ]}
      >
        {`Streaks reset at 12:00 AM ${tzShortLabel}.`}
      </Text>
    </View>
  );
}
