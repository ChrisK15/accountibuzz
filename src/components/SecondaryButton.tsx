import { Pressable, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radii.md,
          minHeight: 48,
          paddingHorizontal: t.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      <Text style={[t.fonts.body, { color: t.colors.text, fontWeight: '700' }]}>
        {label}
      </Text>
    </Pressable>
  );
}
