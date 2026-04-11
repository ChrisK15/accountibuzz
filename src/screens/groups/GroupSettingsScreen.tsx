/**
 * GroupSettingsScreen.tsx
 * Hub for admin controls — navigates to challenge config, member management,
 * and mode switching. Only accessible to admin/co-admin (gated in GroupDetail
 * via useLayoutEffect header button). SCRUM-16, 17, 18, 19.
 */

import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { HomeStackParamList } from '@/types/navigation'
import { useGroup } from '@/hooks/useGroup'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'GroupSettings'>
  route: RouteProp<HomeStackParamList, 'GroupSettings'>
}

export default function GroupSettingsScreen({ navigation, route }: Props) {
  const { groupId } = route.params
  const { group, isLoading, handleUpdateGroup } = useGroup(groupId)
  const [togglingMode, setTogglingMode] = useState(false)

  async function handleToggleMode() {
    if (!group) return
    const next = group.mode === 'competitive' ? 'collaborative' : 'competitive'
    Alert.alert(
      'Change group mode?',
      `Switch to ${next} mode? This affects how the leaderboard is displayed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setTogglingMode(true)
            try {
              await handleUpdateGroup({ mode: next })
            } catch {
              Alert.alert('Error', 'Could not change mode.')
            } finally {
              setTogglingMode(false)
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.textSecondary} /></View>
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Challenge config — SCRUM-16 */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('ConfigureChallenge', { groupId })}
      >
        <View>
          <Text style={styles.rowTitle}>Configure challenge</Text>
          <Text style={styles.rowSub}>{group?.challengeTitle} · {group?.dailyDeadline}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Manage members — SCRUM-17, 19 */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('ManageMembers', { groupId })}
      >
        <View>
          <Text style={styles.rowTitle}>Manage members</Text>
          <Text style={styles.rowSub}>Promote co-admins, manage sabbaticals</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Mode toggle — SCRUM-18 */}
      <TouchableOpacity style={styles.row} onPress={handleToggleMode} disabled={togglingMode}>
        <View>
          <Text style={styles.rowTitle}>Group mode</Text>
          <Text style={styles.rowSub}>
            Currently: {group?.mode === 'competitive' ? '🏆 Competitive' : '🤝 Collaborative'}
          </Text>
        </View>
        {togglingMode
          ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
          : <Text style={styles.switchText}>Switch</Text>
        }
      </TouchableOpacity>

      {/* Invite link shortcut */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('InviteLink', { groupId })}
      >
        <View>
          <Text style={styles.rowTitle}>Invite link</Text>
          <Text style={styles.rowSub}>Share your group invite code</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bgSurface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 10,
  },
  rowTitle: { fontSize: 16, color: COLORS.textPrimary, marginBottom: 2 },
  rowSub: { fontSize: 13, color: COLORS.textMuted },
  arrow: { fontSize: 20, color: COLORS.textMuted },
  switchText: { fontSize: 14, color: COLORS.success },
})
