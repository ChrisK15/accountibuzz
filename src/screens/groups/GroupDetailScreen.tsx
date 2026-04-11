/**
 * GroupDetailScreen.tsx
 * Shows a single group's challenge, member list, and submission status.
 * Admin users see a settings button in the header. The "Submit proof" button
 * will be wired to the camera flow in Phase 5.
 */

import React, { useLayoutEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { HomeStackParamList } from '@/types/navigation'
import { useGroup } from '@/hooks/useGroup'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'GroupDetail'>
  route: RouteProp<HomeStackParamList, 'GroupDetail'>
}

export default function GroupDetailScreen({ navigation, route }: Props) {
  const { groupId } = route.params
  const { group, members, isAdminOrCoAdmin, isLoading } = useGroup(groupId)

  // Add a settings button to the header if the user is an admin/co-admin.
  useLayoutEffect(() => {
    if (isAdminOrCoAdmin) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { groupId })}>
            <Text style={styles.headerBtn}>Settings</Text>
          </TouchableOpacity>
        ),
      })
    }
  }, [isAdminOrCoAdmin, navigation, groupId])

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.textSecondary} />
      </View>
    )
  }

  if (!group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Group not found.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Challenge card */}
      <View style={styles.challengeCard}>
        <Text style={styles.challengeLabel}>Today's challenge</Text>
        <Text style={styles.challengeTitle}>{group.challengeTitle}</Text>
        <Text style={styles.challengeDesc}>{group.challengeDescription}</Text>
        <Text style={styles.deadline}>Deadline: {group.dailyDeadline} · {group.mode}</Text>
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={() => navigation.navigate('SubmitChoice', { groupId })}
      >
        <Text style={styles.submitBtnText}>Submit proof</Text>
      </TouchableOpacity>

      {/* Invite button */}
      <TouchableOpacity
        style={styles.inviteBtn}
        onPress={() => navigation.navigate('InviteLink', { groupId })}
      >
        <Text style={styles.inviteBtnText}>Invite friends</Text>
      </TouchableOpacity>

      {/* Member list */}
      <Text style={styles.sectionLabel}>Members ({members.length})</Text>
      {members.map(m => (
        <View key={m.userId} style={styles.memberRow}>
          <View style={styles.memberLeft}>
            <View style={[styles.dot, m.status === 'active' ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.memberName}>{m.displayName || m.userId}</Text>
          </View>
          <Text style={styles.memberRole}>{m.role}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  headerBtn: { color: COLORS.textSecondary, fontSize: 15, marginRight: 4 },
  challengeCard: {
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 20, marginBottom: 16,
  },
  challengeLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  challengeTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  challengeDesc: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  deadline: { fontSize: 12, color: COLORS.textMuted },
  submitBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  inviteBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 28 },
  inviteBtnText: { color: COLORS.textSecondary, fontSize: 15 },
  sectionLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  memberRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bgSurface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 8,
  },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: COLORS.success },
  dotGray: { backgroundColor: COLORS.textMuted },
  memberName: { fontSize: 15, color: COLORS.textPrimary },
  memberRole: { fontSize: 12, color: COLORS.textMuted },
  errorText: { color: COLORS.textSecondary, fontSize: 15 },
})
