import { Text, type TextStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  children: string;
  style?: TextStyle;
}

export function FormLabel({ children, style }: Props) {
  const t = useTheme();
  return (
    <Text
      style={[
        t.fonts.caption,
        { color: t.colors.textMuted, marginBottom: t.spacing.xs },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
