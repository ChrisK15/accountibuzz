import { View, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: Props) {
  const t = useTheme();
  const fontStyle =
    size === 'lg' ? t.fonts.display : size === 'sm' ? t.fonts.heading2 : t.fonts.heading1;
  const pillPaddingH = size === 'lg' ? t.spacing.md : t.spacing.sm;
  const pillPaddingV = size === 'lg' ? t.spacing.xs : 2;

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="Accountibuzz"
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <Text style={[fontStyle, { color: t.colors.text }]}>accounti</Text>
      <View
        style={{
          backgroundColor: t.colors.primary,
          borderRadius: t.radii.pill,
          paddingHorizontal: pillPaddingH,
          paddingVertical: pillPaddingV,
          marginLeft: t.spacing.xs,
        }}
      >
        <Text style={[fontStyle, { color: t.colors.primaryFg }]}>buzz</Text>
      </View>
    </View>
  );
}
