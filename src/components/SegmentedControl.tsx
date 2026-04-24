// SegmentedControl — equal-width segmented chooser (Photo | Video in P2).
// Spec: 02-UI-SPEC.md §"Component Additions" §1 SegmentedControl.

import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface SegmentedControlProps {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  disabled,
  accessibilityLabel,
  style,
}: SegmentedControlProps) {
  const t = useTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? 'Segmented control'}
      style={[
        {
          flexDirection: 'row',
          backgroundColor: t.colors.surfaceMuted,
          borderRadius: t.radii.md,
          padding: t.spacing.xs,
          height: 44,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected, disabled: !!disabled }}
            onPress={
              disabled || selected ? undefined : () => onChange(opt.value)
            }
            style={({ pressed }) => [
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: t.radii.sm,
                backgroundColor: selected ? t.colors.surface : 'transparent',
                borderWidth: selected ? 1 : 0,
                borderColor: selected ? t.colors.border : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 2,
                shadowOpacity: selected ? 0.05 : 0,
                elevation: selected ? 1 : 0,
                transform: [{ scale: selected && pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Text
              style={[
                t.fonts.body,
                {
                  color: selected ? t.colors.textStrong : t.colors.textMuted,
                  fontWeight: selected ? '700' : '500',
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
