// Join-with-code screen (02-UI-SPEC.md §"Join with code", §"Error state copy").
//
// Analog: app/(auth)/reset-password.tsx VerifyStep — single-input code form with
// typed-error handling + zodResolver + inline submit error.
//
// Input treatment: because src/components/TextInput.tsx does NOT expose an
// `inputStyle` override for the native TextInput element, we render RN's native
// TextInput inline here with the UI-SPEC monospace treatment (Manrope_700Bold,
// 20pt, letterSpacing 2, tabular-nums). We still reuse P1's FormLabel +
// sibling <Text> helper/error pattern for visual consistency. This is explicitly
// permitted by 02-PATTERNS.md line 640 ("planner to pick the cleanest path,
// preferring minimal TextInput extension").

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  Pressable,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Feather } from '@expo/vector-icons';
import {
  joinCodeSchema,
  type JoinCodeInput,
} from '../../../src/features/groups/schemas';
import { normalizeInviteCode } from '../../../src/features/groups/formatInviteCode';
import { useRedeemInvite } from '../../../src/features/groups/useRedeemInvite';
import { useTheme } from '../../../src/theme/useTheme';
import {
  ScreenContainer,
  ScreenHeader,
  FormLabel,
  FormError,
  PrimaryButton,
} from '../../../src/components';

export default function JoinScreen() {
  const t = useTheme();
  const router = useRouter();
  const redeem = useRedeemInvite();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid, isSubmitting },
  } = useForm<JoinCodeInput>({
    resolver: zodResolver(joinCodeSchema),
    mode: 'onChange',
    defaultValues: { code: '' },
  });

  const raw = watch('code') ?? '';
  const displayValue = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;

  const onChangeText = (input: string) => {
    // Normalize on every keystroke: strip non-alphanumeric, uppercase, slice to 8.
    const next = normalizeInviteCode(input);
    setValue('code', next, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const groupId = await redeem.mutateAsync(values.code);
      router.replace(`/groups/${groupId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      switch (msg) {
        case 'group_full':
          setSubmitError(
            "This group's already at 10 members. Ask the admin to make room or start your own.",
          );
          break;
        case 'invite_expired':
          setSubmitError(
            'This invite expired. Ask the admin for a fresh code.',
          );
          break;
        case 'invite_already_used':
          setSubmitError(
            "This code's already been used. Ask the admin for a new one.",
          );
          break;
        case 'already_member':
          setSubmitError("You're already in this group. Head on over.");
          break;
        case 'invite_not_found':
          setSubmitError(
            "We don't know that code. Double-check it with whoever invited you.",
          );
          break;
        default:
          setSubmitError(
            'Something went sideways. Check your connection and try again.',
          );
      }
    }
  });

  const hasFieldError = !!errors.code;
  const borderColor = hasFieldError
    ? t.colors.destructive
    : focused
      ? t.colors.accent
      : t.colors.border;
  const borderWidth = hasFieldError || focused ? 2 : 1;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenContainer>
        {/* Nav bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: t.spacing.md,
            gap: t.spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Feather name="chevron-left" size={24} color={t.colors.textStrong} />
          </Pressable>
          <Text style={[t.fonts.heading2, { color: t.colors.textStrong }]}>
            Got a code?
          </Text>
        </View>

        <ScreenHeader
          title="Got a code?"
          subtitle="Enter it below to join your friends."
        />

        <View style={{ gap: t.spacing.lg }}>
          <Controller
            control={control}
            name="code"
            render={() => (
              <View style={{ width: '100%' }}>
                <FormLabel>Invite code</FormLabel>
                <RNTextInput
                  value={displayValue}
                  onChangeText={onChangeText}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="ABCD-EF12"
                  placeholderTextColor={t.colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={9}
                  keyboardType="default"
                  accessibilityLabel="Invite code"
                  style={{
                    fontFamily: 'Manrope_700Bold',
                    fontSize: 20,
                    letterSpacing: 2,
                    fontVariant: ['tabular-nums'],
                    color: t.colors.text,
                    backgroundColor: t.colors.surface,
                    borderColor,
                    borderWidth,
                    borderRadius: t.radii.md,
                    minHeight: 52,
                    paddingHorizontal: t.spacing.md,
                    paddingVertical: t.spacing.sm,
                  }}
                />
                {errors.code ? (
                  <Text
                    style={[
                      t.fonts.caption,
                      {
                        color: t.colors.destructive,
                        marginTop: t.spacing.xs,
                      },
                    ]}
                  >
                    {errors.code.message}
                  </Text>
                ) : (
                  <Text
                    style={[
                      t.fonts.caption,
                      { color: t.colors.textMuted, marginTop: t.spacing.xs },
                    ]}
                  >
                    8 letters and numbers. Dashes optional.
                  </Text>
                )}
              </View>
            )}
          />

          {submitError ? <FormError>{submitError}</FormError> : null}

          <PrimaryButton
            label="Join group"
            onPress={onSubmit}
            loading={isSubmitting || redeem.isPending}
            disabled={!isValid}
          />
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
