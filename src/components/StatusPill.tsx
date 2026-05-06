// StatusPill — 4-state submission status badge.
// Spec: 03-UI-SPEC.md §1 StatusPill (lines 458-480).
// States: 'none' (em-dash), 'pending' (clock + surfaceMuted bg + 1px border),
//         'approved' (check + primary bg), 'rejected' (x-circle + destructive
//         at ~15% alpha; only variant that is interactive when onPress provided).

import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

export interface StatusPillProps {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  onPress?: () => void; // Only honored when status === 'rejected'.
  rejectionReason?: string | null; // Read by caller in onPress callback context.
}

export function StatusPill({
  status,
  onPress,
  rejectionReason: _rejectionReason,
}: StatusPillProps) {
  const t = useTheme();

  if (status === 'none') {
    return (
      <Text
        accessibilityLabel="No submission yet"
        style={[
          t.fonts.caption,
          { color: t.colors.textMuted, fontWeight: '500' },
        ]}
      >
        —
      </Text>
    );
  }

  const baseStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
    borderRadius: t.radii.pill,
  };

  if (status === 'pending') {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel="Pending review"
        style={[
          baseStyle,
          {
            backgroundColor: t.colors.surfaceMuted,
            borderWidth: 1,
            borderColor: t.colors.border,
          },
        ]}
      >
        <Feather name="clock" size={12} color={t.colors.text} />
        <Text
          style={[
            t.fonts.caption,
            { color: t.colors.text, fontWeight: '500' },
          ]}
        >
          Pending review
        </Text>
      </View>
    );
  }

  if (status === 'approved') {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel="Approved"
        style={[baseStyle, { backgroundColor: t.colors.primary }]}
      >
        <Feather name="check" size={12} color={t.colors.primaryFg} />
        <Text
          style={[
            t.fonts.caption,
            { color: t.colors.primaryFg, fontWeight: '700' },
          ]}
        >
          Approved
        </Text>
      </View>
    );
  }

  // status === 'rejected' — interactive when onPress provided.
  //
  // UAT fix: the destructive token is `hsl(4, 78%, 56%)` and the original
  // `${token}26` alpha-suffix concat produces an invalid CSS string. RN
  // doesn't tint — it falls back to solid destructive, and because the text
  // and icon were ALSO destructive, the pill rendered as a flat red blob
  // with invisible content. Using an `hsla()` literal at 15% alpha for the
  // bg + white text/icon for AA contrast (mirrors the ReviewPanel fix).
  const rejectedBg = 'hsla(4, 78%, 56%, 0.15)';

  const isPressable = !!onPress;

  if (isPressable) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Today didn't count. Tap to see admin's note."
        accessibilityHint="Shows the admin's note"
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={[baseStyle, { backgroundColor: rejectedBg }]}
      >
        <Feather name="x-circle" size={12} color={t.colors.destructive} />
        <Text
          style={[
            t.fonts.caption,
            { color: t.colors.destructive, fontWeight: '500' },
          ]}
        >
          {"Today didn't count"}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Today didn't count"
      style={[baseStyle, { backgroundColor: rejectedBg }]}
    >
      <Feather name="x-circle" size={12} color={t.colors.destructive} />
      <Text
        style={[
          t.fonts.caption,
          { color: t.colors.destructive, fontWeight: '500' },
        ]}
      >
        {"Today didn't count"}
      </Text>
    </View>
  );
}
