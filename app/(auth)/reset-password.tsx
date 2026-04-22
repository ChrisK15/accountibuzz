import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../src/lib/supabase';
import { resetSchema, type ResetInput } from '../../src/features/auth/schemas';
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

export default function ResetPassword() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    token?: string;
    token_hash?: string;
    access_token?: string;
    refresh_token?: string;
    type?: string;
  }>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);

  // If the deep link carried a recovery token hash, exchange it for a session
  // so the subsequent updateUser call authenticates as that user.
  useEffect(() => {
    let cancelled = false;
    async function bootstrapFromDeepLink() {
      const tokenHash = params.token_hash ?? params.token;
      if (!tokenHash) return; // Session may already be established by detectSessionInUrl alt flow.
      const { error } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash,
      });
      if (cancelled) return;
      if (error) {
        setLinkExpired(true);
      }
    }
    bootstrapFromDeepLink();
    return () => {
      cancelled = true;
    };
  }, [params.token_hash, params.token]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setSubmitError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = error.message || '';
        if (/expired|invalid|jwt|token/i.test(msg)) {
          setLinkExpired(true);
        } else {
          setSubmitError(
            'Something went sideways. Check your connection and try again.',
          );
        }
        return;
      }
      // Success — AuthProvider session listener already has us logged in; redirect to app.
      router.replace('/(app)/profile');
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
          title="Set a new password"
          subtitle="Choose something memorable but strong."
        />
        {linkExpired ? (
          <>
            <FormError>
              This reset link has expired. Request a new one.
            </FormError>
            <View style={{ alignItems: 'center', marginTop: t.spacing.md }}>
              <Link href="/(auth)/forgot-password" asChild>
                <GhostButton
                  label="Request a new link"
                  onPress={() => {}}
                />
              </Link>
            </View>
          </>
        ) : (
          <>
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextInput
                  label="New password"
                  placeholder="At least 8 characters"
                  helper="Use 8+ characters with a number and a symbol."
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
                label="Reset password"
                onPress={onSubmit}
                loading={isSubmitting}
                disabled={!isValid}
              />
            </View>
          </>
        )}
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
