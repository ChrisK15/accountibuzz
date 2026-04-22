import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../src/lib/supabase';
import { forgotSchema, type ForgotInput } from '../../src/features/auth/schemas';
import {
  ScreenContainer,
  ScreenHeader,
  Logo,
  TextInput,
  PrimaryButton,
  GhostButton,
  FormError,
} from '../../src/components';
import { useTheme } from '../../src/theme/useTheme';

export default function ForgotPassword() {
  const t = useTheme();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setSubmitError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        const msg = error.message || '';
        if (/not found|no user|no account/i.test(msg)) {
          setSubmitError("We couldn't find an account with that email.");
        } else {
          setSubmitError(
            'Something went sideways. Check your connection and try again.',
          );
        }
        return;
      }
      router.replace({
        pathname: '/(auth)/reset-password',
        params: { email },
      });
    } catch {
      setSubmitError(
        'Something went sideways. Check your connection and try again.',
      );
    }
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScreenContainer>
        <Logo />
        <ScreenHeader
          title="Forgot password?"
          subtitle="Enter your email and we'll send you a 6-digit code."
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextInput
              label="Email"
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
            />
          )}
        />
        {submitError && <FormError>{submitError}</FormError>}
        <View style={{ marginTop: t.spacing.md }}>
          <PrimaryButton
            label="Send reset code"
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={!isValid}
          />
        </View>
        <View style={{ alignItems: 'center', marginTop: t.spacing.lg }}>
          <Link href="/(auth)/login" asChild>
            <GhostButton
              label="Remembered it? Back to login"
              onPress={() => {}}
            />
          </Link>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
