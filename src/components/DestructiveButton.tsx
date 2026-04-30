// DestructiveButton — filled-red P1-inventory-promised primitive (UI-SPEC §Open Item).
// Spec: 03-UI-SPEC.md "DestructiveButton" line 1124-1131.
// First consumers (Plan 03-07): discard-take Modal + reject-reason commit.

import {
  ActivityIndicator,
  Pressable,
  Text,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function DestructiveButton({
  label,
  onPress,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          backgroundColor: t.colors.destructive,
          borderRadius: t.radii.md,
          minHeight: 48,
          paddingHorizontal: t.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[t.fonts.body, { color: '#FFFFFF', fontWeight: '700' }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
