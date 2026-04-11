/**
 * InviteLinkScreen.tsx
 * Shows the group's invite link and a share button. The admin taps "Invite
 * friends" from GroupDetailScreen to get here. Uses the native Share sheet
 * so the user can send the link via any app (Messages, WhatsApp, etc.).
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Share, ActivityIndicator, Alert,
} from 'react-native'
import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { HomeStackParamList } from '@/types/navigation'
import { getGroup } from '@/services/firebase/groupService'
import { buildInviteURL } from '@/utils/inviteLink'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'InviteLink'>
  route: RouteProp<HomeStackParamList, 'InviteLink'>
}

export default function InviteLinkScreen({ route }: Props) {
  const { groupId } = route.params
  const [inviteURL, setInviteURL] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch the group's invite code on mount, then build the shareable URL.
  useEffect(() => {
    getGroup(groupId).then(group => {
      if (group) {
        setInviteCode(group.inviteCode)
        setInviteURL(buildInviteURL(group.inviteCode))
      }
      setIsLoading(false)
    })
  }, [groupId])

  async function handleShare() {
    if (!inviteURL) return
    try {
      await Share.share({ message: `Join my AccountiBuzz group! ${inviteURL}` })
    } catch {
      Alert.alert('Error', 'Could not open share sheet.')
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.textSecondary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite friends</Text>
      <Text style={styles.subtitle}>Share this code or link with anyone you want to join.</Text>

      {/* Big invite code display */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Invite code</Text>
        <Text style={styles.code}>{inviteCode}</Text>
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share invite link</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 32 },
  codeCard: {
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 28, alignItems: 'center', marginBottom: 24,
  },
  codeLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  code: { fontSize: 36, fontWeight: 'bold', color: COLORS.textPrimary, letterSpacing: 6 },
  shareBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 16, alignItems: 'center' },
  shareBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
})
