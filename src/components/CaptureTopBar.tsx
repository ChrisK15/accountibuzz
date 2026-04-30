// CaptureTopBar — absolute-positioned overlay above CameraView.
// Spec: 03-UI-SPEC.md §6a CaptureTopBar (lines 618-633).
// Slots: close (×) on left, group-name pill in center, optional flip-camera
//        on right (video only). All three sit on dark BlurView scrims.

import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/useTheme';

export interface CaptureTopBarProps {
  groupName: string;
  showFlipCamera?: boolean;
  onClose: () => void;
  onFlip?: () => void;
}

export function CaptureTopBar({
  groupName,
  showFlipCamera,
  onClose,
  onFlip,
}: CaptureTopBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const circleStyle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        paddingHorizontal: t.spacing.xl,
        paddingTop: t.spacing.md,
        paddingBottom: t.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Close (×) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={4}
        onPress={onClose}
      >
        <BlurView
          intensity={32}
          tint="dark"
          style={[circleStyle, { overflow: 'hidden' }]}
        >
          <Feather name="x" size={20} color="#FFFFFF" />
        </BlurView>
      </Pressable>

      {/* Group name pill */}
      <BlurView
        intensity={32}
        tint="dark"
        style={{
          paddingHorizontal: t.spacing.md,
          paddingVertical: t.spacing.xs,
          borderRadius: t.radii.pill,
          overflow: 'hidden',
        }}
      >
        <Text
          style={[t.fonts.caption, { color: '#FFFFFF', fontWeight: '500' }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {groupName}
        </Text>
      </BlurView>

      {/* Flip-camera (video only) OR symmetric spacer */}
      {showFlipCamera ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          hitSlop={4}
          onPress={onFlip}
        >
          <BlurView
            intensity={32}
            tint="dark"
            style={[circleStyle, { overflow: 'hidden' }]}
          >
            <Feather name="refresh-cw" size={18} color="#FFFFFF" />
          </BlurView>
        </Pressable>
      ) : (
        <View style={{ width: 40, height: 40 }} />
      )}
    </View>
  );
}
