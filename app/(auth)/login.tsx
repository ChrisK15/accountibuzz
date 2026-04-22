import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../src/lib/supabase';
import { loginSchema, type LoginInput } from '../../src/features/auth/schemas';
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

export default function Login() {
  const t = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setSubmitError(
          "That email and password don't match. Try again or reset your password.",
        );
      }
      // AuthProvider listener redirects on success via root layout gate.
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
          title="Welcome back"
          subtitle="Log in to keep your streak alive."
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextInput
              label="Email"
              placeholder="alex@friends.app"
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
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
            />
          )}
        />
        <View style={{ alignItems: 'flex-end', marginTop: t.spacing.sm }}>
          <Link href="/(auth)/forgot-password" asChild>
            <GhostButton label="Forgot password?" onPress={() => {}} />
          </Link>
        </View>
        {submitError && <FormError>{submitError}</FormError>}
        <View style={{ marginTop: t.spacing.md }}>
          <PrimaryButton
            label="Log in"
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={!isValid}
          />
        </View>
        <View style={{ alignItems: 'center', marginTop: t.spacing.lg }}>
          <Link href="/(auth)/signup" asChild>
            <GhostButton label="New here? Sign up" onPress={() => {}} />
          </Link>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
