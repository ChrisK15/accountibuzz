// Create-group form screen.
// Spec: 02-UI-SPEC.md §"Create group" (lines 363-376), §"Form labels and placeholders"
// (lines 211-218), §"Error state copy" (lines 245-266), §"Copywriting Contract" (lines 162-266).
//
// Invariants:
//   • 4 fields (name / goal / submission_type / timezone) with char counter on goal.
//   • Default submission_type = 'photo' (CONTEXT D-15).
//   • Default timezone = Intl.DateTimeFormat().resolvedOptions().timeZone, UTC fallback.
//   • Submit → useCreateGroup.mutateAsync → router.replace(`/groups/${group_id}`).
//   • Typed RPC errors ('invalid_goal', 'invalid_name', 'invite_code_collision')
//     mapped to exact UI-SPEC copy; everything else → generic.
//   • Button disabled until RHF+Zod validates all 4 fields.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Feather } from '@expo/vector-icons';
import {
  createGroupSchema,
  type CreateGroupInput,
} from '../../../src/features/groups/schemas';
import { useCreateGroup } from '../../../src/features/groups/useCreateGroup';
import { labelFor } from '../../../src/features/groups/timezones';
import { useTheme } from '../../../src/theme/useTheme';
import {
  ScreenContainer,
  ScreenHeader,
  TextInput,
  FormLabel,
  FormError,
  PrimaryButton,
  SegmentedControl,
} from '../../../src/components';
import { IanaTimezonePicker } from '../../../src/features/groups/IanaTimezonePicker';

export default function NewGroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const createGroup = useCreateGroup();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tzPickerOpen, setTzPickerOpen] = useState(false);

  const defaultTz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  })();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      goal: '',
      submission_type: 'photo',
      timezone: defaultTz,
    },
  });

  const currentTz = watch('timezone');
  const currentGoal = watch('goal');
  const goalLen = currentGoal?.length ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const result = await createGroup.mutateAsync(values);
      router.replace(`/groups/${result.group_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'invalid_goal') {
        setSubmitError('Add a bit more detail — at least 5 characters.');
      } else if (msg === 'invalid_name') {
        setSubmitError('Give your group a name.');
      } else if (msg === 'invite_code_collision') {
        setSubmitError("Couldn't create the group. Try again in a sec.");
      } else {
        setSubmitError("Couldn't create the group. Try again in a sec.");
      }
    }
  });

  const counterColor =
    goalLen < 5 || goalLen >= 140 ? t.colors.destructive : t.colors.textMuted;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenContainer>
        {/* Nav: ← Back left, title 'Start a group' center-left */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: t.spacing.md,
            gap: t.spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Feather
              name="chevron-left"
              size={24}
              color={t.colors.textStrong}
            />
          </Pressable>
          <Text style={[t.fonts.heading2, { color: t.colors.textStrong }]}>
            Start a group
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingVertical: t.spacing.lg,
            gap: t.spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title="Start a group"
            subtitle="Three friends, one shared goal. You'll be the admin."
          />

          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextInput
                label="Group name"
                placeholder="Morning runners"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.name?.message}
              />
            )}
          />

          <View>
            <Controller
              control={control}
              name="goal"
              render={({ field }) => (
                <TextInput
                  label="What's the daily goal?"
                  placeholder="Post a photo of your run before 9am."
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.goal?.message}
                />
              )}
            />
            <Text
              style={[
                t.fonts.caption,
                {
                  alignSelf: 'flex-end',
                  color: counterColor,
                  marginTop: t.spacing.xs,
                },
              ]}
            >
              {`${goalLen}/140`}
            </Text>
          </View>

          <View>
            <FormLabel>What do you post?</FormLabel>
            <Controller
              control={control}
              name="submission_type"
              render={({ field }) => (
                <SegmentedControl
                  options={[
                    { value: 'photo', label: 'Photo' },
                    { value: 'video', label: 'Video' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                  accessibilityLabel="Submission type"
                />
              )}
            />
          </View>

          <View>
            <FormLabel>Group timezone</FormLabel>
            <Pressable
              onPress={() => setTzPickerOpen(true)}
              accessibilityLabel="Pick a timezone"
              accessibilityRole="button"
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: t.colors.surfaceMuted,
                  borderRadius: t.radii.md,
                  paddingHorizontal: t.spacing.md,
                  paddingVertical: t.spacing.md + 2,
                  borderWidth: 1,
                  borderColor: t.colors.border,
                }}
              >
                <Text
                  style={[t.fonts.body, { color: t.colors.textStrong, flex: 1 }]}
                  numberOfLines={1}
                >
                  {labelFor(currentTz)}
                </Text>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={t.colors.textMuted}
                />
              </View>
            </Pressable>
            <Text
              style={[
                t.fonts.caption,
                { color: t.colors.textMuted, marginTop: t.spacing.xs },
              ]}
            >
              We'll use this for your daily cutoff.
            </Text>
          </View>

          {submitError ? <FormError>{submitError}</FormError> : null}

          <PrimaryButton
            label="Create group"
            onPress={onSubmit}
            loading={isSubmitting || createGroup.isPending}
            disabled={!isValid}
          />
        </ScrollView>

        <IanaTimezonePicker
          visible={tzPickerOpen}
          initialValue={currentTz}
          onDismiss={() => setTzPickerOpen(false)}
          onSelect={(iana) => {
            setValue('timezone', iana, { shouldValidate: true });
            setTzPickerOpen(false);
          }}
        />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
