/**
 * JoinGroupScreen.tsx
 * Lets a user enter or confirm an invite code to join a group. If the user
 * arrived via a deep link, the code is pre-filled from route params. On
 * success, replaces this screen with GroupDetailScreen so back doesn't loop.
 */

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { HomeStackParamList } from '@/types/navigation'
import { useGroup } from '@/hooks/useGroup'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'JoinGroup'>
  route: RouteProp<HomeStackParamList, 'JoinGroup'>
}

export default function JoinGroupScreen({ navigation, route }: Props) {
  // Pre-fill if the user arrived from a deep link (inviteCode in params).
  const [code, setCode] = useState(route.params?.inviteCode ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { handleJoinByCode } = useGroup()

  async function handleJoin() {
    if (code.trim().length < 8) {
      Alert.alert('Invalid code', 'Invite codes are 8 characters long.')
      return
    }
    setIsSubmitting(true)
    try {
      await handleJoinByCode(code.trim())
      // After joining, navigate to the group list — the new group will appear.
      navigation.replace('GroupList')
    } catch {
      Alert.alert('Error', 'Could not join group. Check the code and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a group</Text>
      <Text style={styles.subtitle}>Enter the 8-character invite code from your friend.</Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. A3FX9QZ2"
        placeholderTextColor={COLORS.textMuted}
        value={code}
        onChangeText={t => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={8}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.joinBtn, isSubmitting && styles.joinBtnDisabled]}
        onPress={handleJoin}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.joinBtnText}>Join group</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 },
  input: {
    backgroundColor: COLORS.bgSurface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, color: COLORS.textPrimary, fontSize: 24,
    fontWeight: 'bold', letterSpacing: 6, marginBottom: 16,
    textAlign: 'center',
  },
  joinBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 16, alignItems: 'center' },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
})
