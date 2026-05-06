// ReviewPanel — post-capture caption + retake/submit row.
// Spec: 03-UI-SPEC.md §6d ReviewPanel (lines 671-697).
// Bottom-anchored panel above safe-area, dark scrim background. Caption input
// + char-counter (destructive at <5/=140) + inline error toast + Retake +
// Submit. KeyboardAvoidingView wraps so the panel rises with the keyboard.

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { PrimaryButton } from './PrimaryButton';

export interface ReviewPanelProps {
  mediaType: 'photo' | 'video';
  caption: string;
  onCaptionChange: (next: string) => void;
  onRetake: () => void;
  onSubmit: () => void;
  loading?: boolean;
  errorText?: string | null;
}

export function ReviewPanel({
  mediaType,
  caption,
  onCaptionChange,
  onRetake,
  onSubmit,
  loading,
  errorText,
}: ReviewPanelProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const submitLabel = mediaType === 'photo' ? 'Submit photo' : 'Submit video';
  const charCount = caption.length;
  const remaining = 140 - charCount;
  const counterColor =
    remaining < 5 || charCount === 140
      ? t.colors.destructive
      : 'rgba(255,255,255,0.7)';
  const counterWeight: '500' | '700' =
    remaining < 5 || charCount === 140 ? '700' : '500';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: t.spacing.xl,
        paddingBottom: Math.max(insets.bottom, t.spacing.lg),
        paddingTop: t.spacing.lg,
        // Dark scrim per UI-SPEC line 685; solid alpha bg is sufficient
        // (a true gradient would need expo-linear-gradient, deferred).
        backgroundColor: 'rgba(0,0,0,0.85)',
      }}
    >
      {/* Caption input row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          borderRadius: t.radii.md,
          paddingHorizontal: t.spacing.xl,
          height: 48,
        }}
      >
        <TextInput
          accessibilityLabel="Optional caption"
          accessibilityValue={{ text: `${charCount} of 140 characters` }}
          value={caption}
          onChangeText={onCaptionChange}
          maxLength={140}
          placeholder="Add a note (optional)"
          placeholderTextColor="rgba(255,255,255,0.55)"
          style={[
            t.fonts.body,
            { flex: 1, color: '#FFFFFF', fontWeight: '500' },
          ]}
          numberOfLines={1}
          cursorColor="#FFFFFF"
        />
        <Text
          style={[
            t.fonts.caption,
            {
              color: counterColor,
              fontWeight: counterWeight,
              fontVariant: ['tabular-nums'],
            },
          ]}
          accessibilityLabel={`${charCount} of 140 characters used`}
        >
          {`${charCount}/140`}
        </Text>
      </View>

      {/* Inline error toast — destructive token is HSL, so `${token}26` alpha
          concat is invalid. Use hsla() literal that mirrors the token's hue. */}
      {errorText ? (
        <View
          style={{
            marginTop: t.spacing.md,
            paddingVertical: t.spacing.sm,
            paddingHorizontal: t.spacing.md,
            backgroundColor: 'hsla(4, 78%, 56%, 0.15)',
            borderRadius: t.radii.sm,
          }}
        >
          <Text
            style={[
              t.fonts.caption,
              { color: '#FFFFFF', fontWeight: '700' },
            ]}
          >
            {errorText}
          </Text>
        </View>
      ) : null}

      {/* Button row */}
      <View
        style={{
          marginTop: t.spacing.md,
          flexDirection: 'row',
          gap: t.spacing.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retake"
          accessibilityHint={`Discards the current ${mediaType} and returns to camera`}
          onPress={onRetake}
          style={({ pressed }) => ({
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
            borderRadius: t.radii.md,
            height: 52,
            paddingHorizontal: t.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={[t.fonts.body, { color: '#FFFFFF', fontWeight: '700' }]}
          >
            Retake
          </Text>
        </Pressable>

        <View style={{ flex: 1 }}>
          <PrimaryButton
            label={submitLabel}
            onPress={onSubmit}
            loading={loading}
            disabled={charCount > 140 || !!loading}
            accessibilityLabel={submitLabel}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
