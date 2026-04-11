/**
 * CreateGroupScreen.tsx
 * Form for creating a new group. User picks a mode (competitive/collaborative),
 * fills in challenge details and daily deadline, then submits. On success,
 * navigates to the new group's detail screen.
 */

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { HomeStackParamList } from '@/types/navigation'
import { useGroup } from '@/hooks/useGroup'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'CreateGroup'>
}

// Validation schema — zod checks these rules before the form can submit.
const schema = z.object({
  challengeTitle: z.string().min(3, 'Title must be at least 3 characters'),
  challengeDescription: z.string().min(10, 'Description must be at least 10 characters'),
  // Deadline must match HH:MM format, e.g. "23:59"
  dailyDeadline: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format (e.g. 23:59)'),
  mode: z.enum(['competitive', 'collaborative']),
})

type FormData = z.infer<typeof schema>

export default function CreateGroupScreen({ navigation }: Props) {
  const { handleCreateGroup } = useGroup()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { mode: 'competitive' },
  })

  const selectedMode = watch('mode')
  const modes = ['competitive', 'collaborative'] as const

  async function onSubmit(data: FormData) {
    setIsSubmitting(true)
    try {
      const groupId = await handleCreateGroup(data)
      navigation.replace('GroupDetail', { groupId })
    } catch {
      Alert.alert('Error', 'Failed to create group. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create a group</Text>
      <Text style={styles.subtitle}>Set your challenge and invite friends to join.</Text>

      {/* Mode selector */}
      <Text style={styles.label}>Group mode</Text>
      <View style={styles.modeRow}>
        {modes.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeCard, selectedMode === m && styles.modeCardActive]}
            onPress={() => setValue('mode', m)}
          >
            <Text style={styles.modeIcon}>{m === 'competitive' ? '🏆' : '🤝'}</Text>
            <Text style={[styles.modeName, selectedMode === m && styles.modeNameActive]}>
              {m === 'competitive' ? 'Competitive' : 'Collaborative'}
            </Text>
            <Text style={styles.modeDesc}>
              {m === 'competitive' ? 'Ranked leaderboard' : 'Everyone wins together'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Challenge title */}
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

      {/* Challenge description */}
      <Text style={styles.label}>Description</Text>
      <Controller
        control={control}
        name="challengeDescription"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, styles.inputMultiline, errors.challengeDescription && styles.inputError]}
            placeholder="What counts as completing this challenge today?"
            placeholderTextColor={COLORS.textMuted}
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={3}
          />
        )}
      />
      {errors.challengeDescription && <Text style={styles.errorText}>{errors.challengeDescription.message}</Text>}

      {/* Daily deadline */}
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
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.submitBtnText}>Create group</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 },
  label: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  modeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  modeCard: {
    flex: 1, alignItems: 'center', padding: 16,
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modeCardActive: { borderColor: COLORS.success },
  modeIcon: { fontSize: 24, marginBottom: 6 },
  modeName: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 2 },
  modeNameActive: { color: COLORS.success },
  modeDesc: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
  input: {
    backgroundColor: COLORS.bgSurface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, color: COLORS.textPrimary, fontSize: 15, marginBottom: 4,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginBottom: 12 },
  submitBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
})
