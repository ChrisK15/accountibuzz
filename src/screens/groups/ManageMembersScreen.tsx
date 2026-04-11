/**
 * ManageMembersScreen.tsx
 * Shows all group members with their roles. Admin can promote a member to
 * co-admin. Members can toggle their own sabbatical status.
 * SCRUM-17, SCRUM-19.
 */

import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { HomeStackParamList } from '@/types/navigation'
import { useGroup } from '@/hooks/useGroup'
import { useAuth } from '@/hooks/useAuth'
import { GroupMember } from '@/types/membership'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'ManageMembers'>
  route: RouteProp<HomeStackParamList, 'ManageMembers'>
}

export default function ManageMembersScreen({ route }: Props) {
  const { groupId } = route.params
  const { firebaseUser } = useAuth()
  const { members, isAdminOrCoAdmin, isLoading, handleUpdateMemberRole, handleUpdateMemberStatus } = useGroup(groupId)
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)

  async function handlePromote(member: GroupMember) {
    Alert.alert(
      'Promote to co-admin?',
      `${member.displayName || member.userId} will be able to review submissions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            setLoadingUserId(member.userId)
            try {
              await handleUpdateMemberRole(member.userId, 'co_admin')
            } catch {
              Alert.alert('Error', 'Could not update role.')
            } finally {
              setLoadingUserId(null)
            }
          },
        },
      ]
    )
  }

  async function handleToggleSabbatical(member: GroupMember) {
    const next = member.status === 'active' ? 'on_sabbatical' : 'active'
    const label = next === 'on_sabbatical' ? 'Go on sabbatical' : 'Return from sabbatical'
    Alert.alert(label, next === 'on_sabbatical'
      ? 'You will not be counted in streaks while on sabbatical.'
      : 'You will resume your streak tracking.')

    setLoadingUserId(member.userId)
    try {
      await handleUpdateMemberStatus(member.userId, next)
    } catch {
      Alert.alert('Error', 'Could not update status.')
    } finally {
      setLoadingUserId(null)
    }
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.textSecondary} /></View>
  }

  function renderMember({ item }: { item: GroupMember }) {
    const isMe = item.userId === firebaseUser?.uid
    const isLoading = loadingUserId === item.userId

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.name}>{item.displayName || item.userId}</Text>
          <View style={styles.badges}>
            <Text style={styles.roleBadge}>{item.role}</Text>
            {item.status === 'on_sabbatical' && (
              <Text style={styles.sabbaticalBadge}>sabbatical</Text>
            )}
          </View>
        </View>
        <View style={styles.rowActions}>
          {/* Admin can promote regular members to co-admin */}
          {isAdminOrCoAdmin && item.role === 'member' && !isMe && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handlePromote(item)}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator size="small" color={COLORS.textSecondary} /> : <Text style={styles.actionBtnText}>Promote</Text>}
            </TouchableOpacity>
          )}
          {/* Members can toggle their own sabbatical */}
          {isMe && (
            <TouchableOpacity
              style={[styles.actionBtn, item.status === 'on_sabbatical' && styles.actionBtnActive]}
              onPress={() => handleToggleSabbatical(item)}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
                : <Text style={styles.actionBtnText}>{item.status === 'active' ? 'Sabbatical' : 'Return'}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={members}
      keyExtractor={m => m.userId}
      renderItem={renderMember}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bgSurface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 8,
  },
  rowLeft: { flex: 1 },
  name: { fontSize: 15, color: COLORS.textPrimary, marginBottom: 4 },
  badges: { flexDirection: 'row', gap: 6 },
  roleBadge: { fontSize: 11, color: COLORS.textMuted, backgroundColor: COLORS.bgElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  sabbaticalBadge: { fontSize: 11, color: COLORS.warning, backgroundColor: COLORS.bgElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  rowActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnActive: { borderColor: COLORS.warning },
  actionBtnText: { fontSize: 13, color: COLORS.textSecondary },
})
