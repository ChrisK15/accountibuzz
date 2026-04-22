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

export function PrimaryButton({
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
          backgroundColor: t.colors.primary,
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
        <ActivityIndicator color={t.colors.primaryFg} />
      ) : (
        <Text style={[t.fonts.body, { color: t.colors.primaryFg, fontWeight: '700' }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
