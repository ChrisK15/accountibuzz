import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../src/lib/supabase';
import { signupSchema, type SignupInput } from '../../src/features/auth/schemas';
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

export default function Signup() {
  const t = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        // Supabase returns "User already registered" or similar
        const msg = error.message || '';
        if (/already|registered|exists/i.test(msg)) {
          setSubmitError(
            "That email's already signed up. Try logging in instead.",
          );
        } else {
          setSubmitError(
            'Something went sideways. Check your connection and try again.',
          );
        }
      }
      // On success, AuthProvider listener + root layout gate redirect to /(app)/ (groups list).
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
          title="Join the buzz"
          subtitle="Three friends, one daily goal."
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
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextInput
              label="Password"
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <TextInput
              label="Confirm password"
              placeholder="Repeat password"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.confirmPassword?.message}
            />
          )}
        />
        {submitError && <FormError>{submitError}</FormError>}
        <View style={{ marginTop: t.spacing.md }}>
          <PrimaryButton
            label="Create account"
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={!isValid}
          />
        </View>
        <View style={{ marginTop: t.spacing.md, alignItems: 'center' }}>
          <Text
            style={[
              t.fonts.caption,
              { color: t.colors.textMuted, textAlign: 'center' },
            ]}
          >
            By continuing you agree to our{' '}
            <Text style={{ color: t.colors.accent }}>Terms</Text> and{' '}
            <Text style={{ color: t.colors.accent }}>Privacy Policy</Text>.
          </Text>
        </View>
        <View style={{ alignItems: 'center', marginTop: t.spacing.lg }}>
          <Link href="/(auth)/login" asChild>
            <GhostButton
              label="Already have an account? Log in"
              onPress={() => {}}
            />
          </Link>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
