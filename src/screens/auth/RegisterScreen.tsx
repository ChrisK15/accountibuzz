import React from 'react';
import { Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthStackParamList } from '@/types/navigation';
import { useAuth } from '@/hooks/useAuth';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import ErrorBanner from '@/components/common/ErrorBanner';
import { COLORS } from '@/utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterScreen({ navigation }: Props) {
  const { registerUser, isSubmitting, bannerError, clearErrors } = useAuth();

  const { control, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(data: FormData) {
    const err = await registerUser(data.email, data.password);
    if (err?.target === 'email') setError('email', { message: err.message });
    if (err?.target === 'password') setError('password', { message: err.message });
    if (!err) navigation.navigate('SetupProfile');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create account</Text>

        {bannerError && <ErrorBanner message={bannerError} onDismiss={clearErrors} />}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
              testID="register-email"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Password"
              value={value}
              onChangeText={onChange}
              secureTextEntry
              autoComplete="new-password"
              error={errors.password?.message}
              testID="register-password"
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Confirm password"
              value={value}
              onChangeText={onChange}
              secureTextEntry
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              testID="register-confirm-password"
            />
          )}
        />

        <Button
          label="Create account"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          testID="register-submit"
        />

        <Button
          label="Already have an account? Sign in"
          onPress={() => navigation.navigate('SignIn')}
          variant="ghost"
          disabled={isSubmitting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bgPrimary },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 },
});
