/**
 * ConfigureChallengeScreen.tsx
 * Lets the group admin edit the challenge title, description, and daily
 * deadline. Pre-fills the form with current values from Firestore.
 * SCRUM-16.
 */

import React, { useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { HomeStackParamList } from '@/types/navigation'
import { useGroup } from '@/hooks/useGroup'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'ConfigureChallenge'>
  route: RouteProp<HomeStackParamList, 'ConfigureChallenge'>
}

const schema = z.object({
  challengeTitle: z.string().min(3, 'Title must be at least 3 characters'),
  challengeDescription: z.string().min(10, 'Description must be at least 10 characters'),
  dailyDeadline: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format (e.g. 23:59)'),
})

type FormData = z.infer<typeof schema>

export default function ConfigureChallengeScreen({ navigation, route }: Props) {
  const { groupId } = route.params
  const { group, isLoading, handleUpdateGroup } = useGroup(groupId)

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Pre-fill form once group data loads from Firestore.
  useEffect(() => {
    if (group) {
      reset({
        challengeTitle: group.challengeTitle,
        challengeDescription: group.challengeDescription,
        dailyDeadline: group.dailyDeadline,
      })
    }
  }, [group, reset])

  async function onSubmit(data: FormData) {
    try {
      await handleUpdateGroup(data)
      navigation.goBack()
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.')
    }
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.textSecondary} /></View>
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Challenge title</Text>
      <Controller
        control={control}
        name="challengeTitle"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, errors.challengeTitle && styles.inputError]}
            placeholder="e.g. Daily 5k run"
            placeholderTextColor={COLORS.textMuted}
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      {errors.challengeTitle && <Text style={styles.errorText}>{errors.challengeTitle.message}</Text>}

      <Text style={styles.label}>Description</Text>
      <Controller
        control={control}
        name="challengeDescription"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, styles.inputMultiline, errors.challengeDescription && styles.inputError]}
            placeholder="What counts as completing this challenge?"
            placeholderTextColor={COLORS.textMuted}
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={3}
          />
        )}
      />
      {errors.challengeDescription && <Text style={styles.errorText}>{errors.challengeDescription.message}</Text>}

      <Text style={styles.label}>Daily deadline (HH:MM)</Text>
      <Controller
        control={control}
        name="dailyDeadline"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, errors.dailyDeadline && styles.inputError]}
            placeholder="23:59"
            placeholderTextColor={COLORS.textMuted}
            value={value}
            onChangeText={onChange}
            keyboardType="numeric"
            maxLength={5}
          />
        )}
      />
      {errors.dailyDeadline && <Text style={styles.errorText}>{errors.dailyDeadline.message}</Text>}

      <TouchableOpacity
        style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.saveBtnText}>Save changes</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  label: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: COLORS.bgSurface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, color: COLORS.textPrimary, fontSize: 15, marginBottom: 4,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginBottom: 12 },
  saveBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 12 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
})
