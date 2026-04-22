import { View, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  style?: ViewStyle;
}

export function ScreenHeader({ title, subtitle, align = 'left', style }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          marginTop: t.spacing['2xl'],
          marginBottom: t.spacing.xl,
          alignItems: align === 'center' ? 'center' : 'flex-start',
        },
        style,
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[
          t.fonts.display,
          {
            color: t.colors.textStrong,
            textAlign: align,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            t.fonts.body,
            {
              color: t.colors.textMuted,
              marginTop: t.spacing.sm,
              textAlign: align,
            },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
