// InviteCodeChip — chunked XXXX-XXXX code display + Copy text button.
// Spec: 02-UI-SPEC.md §"Component Additions" §2 InviteCodeChip.
// Interaction contract (02-UI-SPEC.md §Interaction Contracts "Copy code"):
//   Clipboard.setStringAsync(raw) + Haptics.Success + in-place 'Copy' → 'Copied ✓' for 2s.

import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { formatInviteCode } from '../features/groups/formatInviteCode';

export interface InviteCodeChipProps {
  code: string; // raw 8-char
  onCopy?: () => void;
}

function letterByLetterLabel(formatted: string): string {
  const parts = [];
  for (const ch of formatted) {
    parts.push(ch === '-' ? 'dash' : ch);
  }
  return `Invite code: ${parts.join(', ')}`;
}

export function InviteCodeChip({ code, onCopy }: InviteCodeChipProps) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const formatted = formatInviteCode(code);
  const a11y = letterByLetterLabel(formatted);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(code);
    } catch {
      // Clipboard failure should not block UX.
    }
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics may be unavailable on simulator; degrade silently (Pattern 7).
    }
    setCopied(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 2000);
    onCopy?.();
  };

  return (
    <View
      accessibilityLabel={a11y}
      style={{
        backgroundColor: t.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        paddingVertical: t.spacing.lg,
        paddingHorizontal: t.spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontFamily: 'Manrope_700Bold',
          fontSize: 20,
          letterSpacing: 2,
          fontVariant: ['tabular-nums'],
          color: t.colors.textStrong,
        }}
      >
        {formatted}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied' : 'Copy invite code'}
        onPress={handleCopy}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          marginLeft: t.spacing.md,
        })}
      >
        <Text
          style={[
            t.fonts.body,
            {
              color: copied ? t.colors.success : t.colors.accent,
              fontWeight: '700',
            },
          ]}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </Text>
      </Pressable>
    </View>
  );
}
