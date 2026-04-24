import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from '../../src/features/auth/AuthProvider';
import { useProfile } from '../../src/features/profile/useProfile';
import { useUpdateProfile } from '../../src/features/profile/useUpdateProfile';
import { useAvatarUpload } from '../../src/features/profile/useAvatarUpload';
import {
  profileUpdateSchema,
  type ProfileUpdateInput,
} from '../../src/features/profile/schemas';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme/useTheme';
import {
  ScreenContainer,
  ScreenHeader,
  Avatar,
  TextInput,
  PrimaryButton,
  GhostButton,
  DestructiveTextButton,
} from '../../src/components';

export default function Profile() {
  const t = useTheme();
  const { user } = useSession();
  const { data: profile, isPending } = useProfile(user?.id);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // WR-08: append `?v={profile.updated_at}` so expo-image busts its URL cache
  // after an upsert to the stable `{userId}/avatar.jpg` path.
  const avatarUrl = profile?.avatar_path
    ? `${
        supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data
          .publicUrl
      }?v=${encodeURIComponent(profile.updated_at)}`
    : null;

  const upload = useAvatarUpload(user?.id);
  const update = useUpdateProfile(user?.id);

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    mode: 'onBlur',
    defaultValues: { display_name: profile?.display_name ?? '' },
    values: profile ? { display_name: profile.display_name } : undefined,
  });

  if (!user || isPending || !profile) return null;
  const onboarding = profile.display_name === '';

  async function handleLogout() {
    Alert.alert('Log out?', "You'll need to log back in to keep posting.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          // WR-07: signOut returns { error } — surfacing it avoids the stuck
          // state where AuthProvider never receives SIGNED_OUT (Supabase only
          // emits on success) and the user keeps tapping with no feedback.
          const { error } = await supabase.auth.signOut();
          if (error) {
            Alert.alert(
              'Sign out failed',
              'Check your connection and try again.',
            );
          }
        },
      },
    ]);
  }

  const onSave = handleSubmit(async ({ display_name }) => {
    await update.mutateAsync({ display_name });
    setMode('view');
  });

  // ── Onboarding state ─────────────────────────────────────────────
  if (onboarding) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenContainer scroll>
          <ScreenHeader
            title="Let's set up your profile"
            subtitle="Friends will see this when you check in. You can change this anytime."
          />
          <View style={{ alignItems: 'center', marginBottom: t.spacing.xl }}>
            <Pressable
              onPress={() => upload.mutate()}
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
            >
              <Avatar
                name={profile.display_name || '?'}
                imageUri={avatarUrl}
                size={96}
              />
            </Pressable>
          </View>
          <View style={{ marginBottom: t.spacing.md }}>
            <GhostButton label="Add a photo" onPress={() => upload.mutate()} />
          </View>
          <Controller
            control={control}
            name="display_name"
            render={({ field, fieldState }) => (
              <TextInput
                label="Display name"
                placeholder="What should we call you?"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          <View style={{ marginTop: t.spacing.xl }}>
            <PrimaryButton
              label="Continue"
              onPress={onSave}
              disabled={!isValid}
              loading={isSubmitting}
            />
          </View>
          {/* WR-04: removed no-op "Skip for now" button. P1 onboarding has no
              partial/skip state — `onboarding = display_name === ''` only exits
              once a display name is saved. Adding a display name is required to
              leave onboarding; a skip button that does nothing invites rage-taps. */}
        </ScreenContainer>
      </KeyboardAvoidingView>
    );
  }

  // ── View state ───────────────────────────────────────────────────
  if (mode === 'view') {
    return (
      <ScreenContainer scroll>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: t.spacing.xl,
            marginBottom: t.spacing.lg,
          }}
        >
          <Text style={[t.fonts.heading2, { color: t.colors.textStrong }]}>
            Profile
          </Text>
          <GhostButton label="Edit" onPress={() => setMode('edit')} />
        </View>
        <View style={{ alignItems: 'center', marginBottom: t.spacing.lg }}>
          <Avatar
            name={profile.display_name}
            imageUri={avatarUrl}
            size={96}
          />
        </View>
        <Text
          style={[
            t.fonts.heading1,
            {
              color: t.colors.textStrong,
              textAlign: 'center',
              marginBottom: t.spacing.xs,
            },
          ]}
        >
          {profile.display_name}
        </Text>
        <Text
          style={[
            t.fonts.caption,
            {
              color: t.colors.textMuted,
              textAlign: 'center',
              marginBottom: t.spacing.xl,
            },
          ]}
        >
          {user.email}
        </Text>
        {/* Stat card shells — P1 placeholders */}
        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <View
            style={{
              flex: 1,
              padding: t.spacing.lg,
              borderRadius: t.radii.lg,
              backgroundColor: t.colors.surface,
            }}
          >
            <Text style={[t.fonts.caption, { color: t.colors.textMuted }]}>
              DAY STREAK
            </Text>
            <Text
              style={[t.fonts.heading1, { color: t.colors.textStrong }]}
            >
              —
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: t.spacing.lg,
              borderRadius: t.radii.lg,
              backgroundColor: t.colors.surface,
            }}
          >
            <Text style={[t.fonts.caption, { color: t.colors.textMuted }]}>
              POINTS
            </Text>
            <Text
              style={[t.fonts.heading1, { color: t.colors.textStrong }]}
            >
              0
            </Text>
          </View>
        </View>
        {/* "Today's goal" card hidden — user has no groups in P1 */}
      </ScreenContainer>
    );
  }

  // ── Edit state ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScreenContainer scroll>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: t.spacing.xl,
            marginBottom: t.spacing.lg,
          }}
        >
          <Text style={[t.fonts.heading2, { color: t.colors.textStrong }]}>
            Edit profile
          </Text>
          <GhostButton label="Cancel" onPress={() => setMode('view')} />
        </View>
        <View style={{ alignItems: 'center', marginBottom: t.spacing.sm }}>
          <Pressable
            onPress={() => upload.mutate()}
            accessibilityRole="button"
            accessibilityLabel="Change avatar"
          >
            <Avatar
              name={profile.display_name}
              imageUri={avatarUrl}
              size={96}
            />
          </Pressable>
        </View>
        <View style={{ marginBottom: t.spacing.lg }}>
          <GhostButton
            label="Change avatar"
            onPress={() => upload.mutate()}
          />
        </View>
        <Controller
          control={control}
          name="display_name"
          render={({ field, fieldState }) => (
            <TextInput
              label="Display name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        <View style={{ marginTop: t.spacing.md }}>
          <TextInput
            label="Email"
            value={user.email ?? ''}
            onChangeText={() => {
              /* read-only */
            }}
            disabled
            helper="Email can't be changed here."
          />
        </View>
        <View style={{ marginTop: t.spacing.xl }}>
          <PrimaryButton
            label="Save changes"
            onPress={onSave}
            disabled={!isValid}
            loading={isSubmitting}
          />
        </View>
        <View style={{ marginTop: t.spacing['2xl'] }}>
          <DestructiveTextButton label="Log out" onPress={handleLogout} />
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
