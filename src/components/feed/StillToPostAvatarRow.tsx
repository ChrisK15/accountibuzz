// StillToPostAvatarRow — overlapping avatars + comma-list + cutoff inline.
// Spec: 04-UI-SPEC.md §"Component Additions §3 StillToPostAvatarRow" (lines 557-596)
//       + Copywriting Contract "Still to post (FEED-02)" (lines 345-359).
//
// Anatomy:
//   [Avatar overlap row] [comma-list] [cutoff inline (clock + label)]
//
// Comma-list rules (per UI-SPEC line 350-354):
//   0 missers  → component returns null (empty section)
//   1 misser   → "Sam"
//   2-3 missers → "Sam · Riley · Tomás"
//   4+ missers → "Sam · Riley · {N - 2} more"
//
// 2px ring-surface border on each overlapping avatar (per UI-SPEC line 99 +
// Token Mapping table line 250). The ring color matches `surface` so adjacent
// avatars visually separate.
//
// Cutoff is `--text-muted` (NOT destructive, per UI-SPEC §Tone Discipline
// line 359 — group-level info, not personal urgency).

import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { useTheme } from '../../theme/useTheme';

export interface StillToPostMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface StillToPostAvatarRowProps {
  members: StillToPostMember[];
  /** e.g. "9:00 PM" — pre-formatted by parent. When provided, renders the inline cutoff. */
  cutoffLabel?: string;
  /** Default 5. */
  maxVisible?: number;
}

function firstName(displayName: string): string {
  return displayName.split(/\s+/)[0] ?? displayName;
}

function commaList(members: StillToPostMember[]): string {
  if (members.length === 1) return firstName(members[0].displayName);
  if (members.length === 2)
    return `${firstName(members[0].displayName)} · ${firstName(members[1].displayName)}`;
  if (members.length === 3)
    return `${firstName(members[0].displayName)} · ${firstName(members[1].displayName)} · ${firstName(members[2].displayName)}`;
  // 4+
  return `${firstName(members[0].displayName)} · ${firstName(members[1].displayName)} · ${members.length - 2} more`;
}

function compositeA11yLabel(
  members: StillToPostMember[],
  cutoffLabel?: string,
): string {
  const allNames = members.map((m) => m.displayName).join(', ');
  const trailing = cutoffLabel ? `, cutoff at ${cutoffLabel}` : '';
  return `${members.length} still to post: ${allNames}${trailing}`;
}

export function StillToPostAvatarRow({
  members,
  cutoffLabel,
  maxVisible = 5,
}: StillToPostAvatarRowProps) {
  const t = useTheme();

  // Per UI-SPEC §Still-to-post state matrix line 842: 0 missers → section absent.
  if (members.length === 0) return null;

  const visible = members.slice(0, maxVisible);
  const overflow = members.length - visible.length;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={compositeA11yLabel(members, cutoffLabel)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
      }}
    >
      {/* Avatar overlap row — decorative, hidden from a11y */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        {visible.map((m, index) => (
          <View
            key={m.userId}
            style={{
              marginLeft: index === 0 ? 0 : -t.spacing.sm,
              borderWidth: 2,
              borderColor: t.colors.surface,
              borderRadius: 32 / 2,
            }}
          >
            <Avatar
              size={32}
              name={m.displayName}
              imageUri={m.avatarUrl ?? null}
            />
          </View>
        ))}
        {overflow > 0 ? (
          <View
            style={{
              marginLeft: -t.spacing.sm,
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: t.colors.surface,
              backgroundColor: t.colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={[
                t.fonts.caption,
                {
                  color: t.colors.text,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                },
              ]}
            >
              {`+${overflow}`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Comma-list (middle, flex:1, truncate on narrow widths) */}
      <Text
        style={[
          t.fonts.body,
          {
            color: t.colors.textMuted,
            fontWeight: '500',
            flex: 1,
          },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {commaList(members)}
      </Text>

      {/* Cutoff inline — only when cutoffLabel provided */}
      {cutoffLabel ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.xs,
          }}
        >
          <Feather name="clock" size={12} color={t.colors.textMuted} />
          <Text
            style={[
              t.fonts.caption,
              {
                color: t.colors.textMuted,
                fontWeight: '500',
              },
            ]}
          >
            {`${cutoffLabel} cutoff`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
