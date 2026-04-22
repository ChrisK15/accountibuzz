import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../src/lib/supabase';
import {
  otpSchema,
  resetSchema,
  type OtpInput,
  type ResetInput,
} from '../../src/features/auth/schemas';
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

type Step = 'verify' | 'setpw';

export default function ResetPassword() {
  const t = useTheme();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>('verify');

  if (!email) {
    return (
      <ScreenContainer>
        <Logo />
        <ScreenHeader
          title="Missing email"
          subtitle="Start from the forgot-password screen."
        />
        <View style={{ alignItems: 'center', marginTop: t.spacing.md }}>
          <Link href="/(auth)/forgot-password" asChild>
            <GhostButton label="Request a code" onPress={() => {}} />
          </Link>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScreenContainer>
        <Logo />
        {step === 'verify' ? (
          <VerifyStep
            email={email}
            onVerified={() => setStep('setpw')}
          />
        ) : (
          <SetPasswordStep onDone={() => router.replace('/(app)/profile')} />
        )}
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function VerifyStep({
  email,
  onVerified,
}: {
  email: string;
  onVerified: () => void;
}) {
  const t = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    mode: 'onBlur',
    defaultValues: { token: '' },
  });

  const onSubmit = handleSubmit(async ({ token }) => {
    setSubmitError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });
      if (error) {
        const msg = error.message || '';
        if (/expired|invalid|token/i.test(msg)) {
          setSubmitError(
            "That code didn't work. It may have expired — request a new one.",
          );
        } else {
          setSubmitError(
            'Something went sideways. Check your connection and try again.',
          );
        }
        return;
      }
      onVerified();
    } catch {
      setSubmitError(
        'Something went sideways. Check your connection and try again.',
      );
    }
  });

  return (
    <>
      <ScreenHeader
        title="Enter your code"
        subtitle={`We sent a code to ${email}.`}
      />
      <Controller
        control={control}
        name="token"
        render={({ field }) => (
          <TextInput
            label="Reset code"
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.token?.message}
          />
        )}
      />
      {submitError && <FormError>{submitError}</FormError>}
      <View style={{ marginTop: t.spacing.md }}>
        <PrimaryButton
          label="Verify code"
          onPress={onSubmit}
          loading={isSubmitting}
          disabled={!isValid}
        />
      </View>
      <View style={{ alignItems: 'center', marginTop: t.spacing.lg }}>
        <Link href="/(auth)/forgot-password" asChild>
          <GhostButton label="Request a new code" onPress={() => {}} />
        </Link>
      </View>
    </>
  );
}

function SetPasswordStep({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
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
        setSubmitError(
          'Something went sideways. Check your connection and try again.',
        );
        return;
      }
      onDone();
    } catch {
      setSubmitError(
        'Something went sideways. Check your connection and try again.',
      );
    }
  });

  return (
    <>
      <ScreenHeader
        title="Set a new password"
        subtitle="Choose something memorable but strong."
      />
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
  );
}
