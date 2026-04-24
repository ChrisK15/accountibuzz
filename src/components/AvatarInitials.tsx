import { View, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
  }
  return h >>> 0;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  // WR-05: Iterate by code point (not UTF-16 code unit) so emoji-first names
  // like '🔥 Flame' don't render as a lone high surrogate followed by 'F'.
  const firstChar = (s: string) => Array.from(s)[0] ?? '';
  if (parts.length === 1) return firstChar(parts[0]).toUpperCase();
  return (firstChar(parts[0]) + firstChar(parts[parts.length - 1])).toUpperCase();
}

export function hueFor(name: string): number {
  return djb2(name) % 360;
}

interface Props {
  name: string;
  size?: number;
}

export function AvatarInitials({ name, size = 64 }: Props) {
  const t = useTheme();
  const hue = hueFor(name);
  const lightness = t.name === 'dark' ? 35 : 75;
  const bg = `hsl(${hue}, 60%, ${lightness}%)`;
  const fg = t.colors.textStrong;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${name || 'no name'}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[t.fonts.heading1, { color: fg }]}>{initialsFor(name)}</Text>
    </View>
  );
}
