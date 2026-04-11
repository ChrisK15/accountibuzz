/**
 * GroupListScreen.tsx
 * Shows all groups the current user belongs to. Replaces the previous mock
 * data with a live Firestore subscription via useGroups(). Tapping a group
 * navigates to GroupDetailScreen.
 */

import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { HomeStackParamList } from '@/types/navigation'
import { useGroups } from '@/hooks/useGroups'
import { Group } from '@/types/group'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'GroupList'>
}

export default function GroupListScreen({ navigation }: Props) {
  const { groups, isLoading } = useGroups()

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.textSecondary} />
      </View>
    )
  }

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No groups yet</Text>
        <Text style={styles.emptySubtitle}>Create one or join with an invite link</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateGroup')}>
          <Text style={styles.createBtnText}>Create a group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.joinBtn} onPress={() => navigation.navigate('JoinGroup', {})}>
          <Text style={styles.joinBtnText}>Join with a code</Text>
        </TouchableOpacity>
      </View>
    )
  }

  function renderGroup({ item }: { item: Group }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.groupName}>{item.challengeTitle}</Text>
            <Text style={styles.challenge}>{item.challengeDescription}</Text>
          </View>
          <View style={styles.modeBadge}>
            <Text style={styles.modeText}>{item.mode === 'competitive' ? '🏆' : '🤝'}</Text>
          </View>
        </View>
        <Text style={styles.meta}>Deadline: {item.dailyDeadline}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderGroup}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => Alert.alert('Add a group', undefined, [
              { text: 'Create a group', onPress: () => navigation.navigate('CreateGroup') },
              { text: 'Join with a code', onPress: () => navigation.navigate('JoinGroup', {}) },
              { text: 'Cancel', style: 'cancel' },
            ])}
          >
            <Text style={styles.addBtnText}>+ Create or join a group</Text>
          </TouchableOpacity>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  list: { padding: 16 },
  card: {
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1, marginRight: 12 },
  groupName: { fontSize: 17, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 2 },
  challenge: { fontSize: 13, color: COLORS.textSecondary },
  modeBadge: { backgroundColor: COLORS.bgElevated, borderRadius: 8, padding: 8 },
  modeText: { fontSize: 16 },
  meta: { fontSize: 12, color: COLORS.textMuted },
  addBtn: {
    padding: 16, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, alignItems: 'center', borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 15, color: COLORS.textSecondary },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: COLORS.bgPrimary },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28 },
  createBtn: { backgroundColor: COLORS.success, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, marginBottom: 12 },
  createBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  joinBtn: { paddingVertical: 14, paddingHorizontal: 32 },
  joinBtnText: { color: COLORS.textSecondary, fontSize: 15 },
})
