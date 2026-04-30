// TypeChip — photo/video group indicator pill.
// Spec: 03-UI-SPEC.md §2 TypeChip (lines 482-491).

import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

export interface TypeChipProps {
  kind: 'photo' | 'video';
}

export function TypeChip({ kind }: TypeChipProps) {
  const t = useTheme();
  const label = kind === 'photo' ? 'Photo' : 'Video';
  const iconName = kind === 'photo' ? 'camera' : 'video';
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label} group`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        backgroundColor: t.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radii.pill,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: t.spacing.xs,
      }}
    >
      <Feather name={iconName} size={13} color={t.colors.textMuted} />
      <Text
        style={[
          t.fonts.caption,
          { color: t.colors.textMuted, fontWeight: '500' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
