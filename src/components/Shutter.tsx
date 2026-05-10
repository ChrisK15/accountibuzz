// Shutter — 3-variant camera shutter primitive.
// Spec: 03.1-03-PLAN.md Task 2 (D-08..D-10) supersedes 03-UI-SPEC.md §6b.
// Variants share a 72pt outer 4pt white ring (opacity-pulses while recording)
// + 52pt inner circle. Photo/video-idle add a Feather glyph; video-recording
// is a clean filled red circle (the original "square inside a circle"
// geometry was logged as "blocky" by the user on 2026-05-06).

import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

const ICON_SIZE = 30;

export interface ShutterProps {
  variant: 'photo' | 'video-idle' | 'video-recording';
  onPress: () => void;
}

export function Shutter({ variant, onPress }: ShutterProps) {
  const t = useTheme();
  const a11yLabel =
    variant === 'photo'
      ? 'Take photo'
      : variant === 'video-idle'
        ? 'Start recording'
        : 'Stop recording';
  const isRecording = variant === 'video-recording';
  const innerColor = isRecording ? t.colors.destructive : t.colors.primary;

  // Pulse animation for video-recording: opacity 0.85 ↔ 1 over 1.4s loop (UI-SPEC line 650).
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isRecording) {
      pulseOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 1.0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulseOpacity]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? (isRecording ? 0.95 : 0.92) : 1 }],
      })}
    >
      {/* Outer 4pt white ring — pulses while recording. */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 72,
          height: 72,
          borderRadius: 36,
          borderWidth: 4,
          borderColor: '#FFFFFF',
          opacity: pulseOpacity,
        }}
      />
      {/* Inner fill — uniform 52pt circle for all variants. Per D-09 +
          Pitfall 5, 52pt keeps a comfortable visual gap to the 64pt usable
          inner diameter (72pt outer - 4pt ring × 2). */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: innerColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {variant === 'photo' && (
          <Feather name="camera" size={ICON_SIZE} color="#FFFFFF" />
        )}
        {variant === 'video-idle' && (
          <Feather name="video" size={ICON_SIZE} color="#FFFFFF" />
        )}
        {/* video-recording: clean filled red circle, no glyph */}
      </View>
    </Pressable>
  );
}
