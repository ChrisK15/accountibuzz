import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../theme/useTheme';
import { AvatarInitials } from './AvatarInitials';

interface Props {
  name: string;
  imageUri?: string | null;
  size?: number;
  accessibilityLabel?: string;
}

export function Avatar({ name, imageUri, size = 64, accessibilityLabel }: Props) {
  const t = useTheme();
  if (imageUri) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel ?? `Avatar for ${name || 'no name'}`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: t.colors.surfaceMuted,
        }}
      >
        <Image
          source={{ uri: imageUri }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      </View>
    );
  }
  return <AvatarInitials name={name} size={size} />;
}
