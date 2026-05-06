// Shutter — 3-variant camera shutter primitive.
// Spec: 03-UI-SPEC.md §6b Shutter (lines 636-652).
// Variants: 'photo' | 'video-idle' (yellow circle) | 'video-recording' (red square + pulsing ring).

import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

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
      {/* Inner fill — primary yellow OR destructive red. Becomes a square
          (borderRadius 0) while recording per UI-SPEC §6b.
          Recording variant: 44pt so the square's diagonal (62.2pt) stays
          inside the outer ring's inner diameter (64pt). 52pt would clip the
          ring at the corners (52*sqrt(2) = 73.5pt > 64pt). */}
      <View
        style={{
          width: isRecording ? 44 : 52,
          height: isRecording ? 44 : 52,
          borderRadius: isRecording ? 0 : 26,
          backgroundColor: innerColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isRecording && (
          <View
            style={{ width: 16, height: 16, backgroundColor: '#FFFFFF' }}
          />
        )}
      </View>
    </Pressable>
  );
}
