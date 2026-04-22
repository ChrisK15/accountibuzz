import { Text, type TextStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  children: string;
  style?: TextStyle;
}

export function FormError({ children, style }: Props) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="text"
      style={[
        t.fonts.caption,
        { color: t.colors.destructive, marginTop: t.spacing.xs },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
