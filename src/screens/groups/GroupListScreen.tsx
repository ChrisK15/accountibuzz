import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/utils/constants';

// Mock data for showcase — will be replaced by real Firestore data in Phase 3
const MOCK_GROUPS = [
  { id: '1', name: 'Morning Crew', challenge: 'Daily 5k run', mode: 'competitive', memberCount: 4, myStreak: 7 },
  { id: '2', name: 'Dev Grind', challenge: '1 LeetCode per day', mode: 'collaborative', memberCount: 3, myStreak: 3 },
];

export default function GroupListScreen({ navigation }: any) {
  const { userProfile } = useAuth();

  if (MOCK_GROUPS.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyTitle}>No groups yet</Text>
        <Text style={styles.emptySubtitle}>Create one or join with an invite link</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateGroup')}>
          <Text style={styles.createBtnText}>Create a group</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_GROUPS}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.challenge}>{item.challenge}</Text>
              </View>
              <View style={styles.streakBadge}>
                <Text style={styles.streakNum}>🔥 {item.myStreak}</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.meta}>{item.memberCount} members · {item.mode}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateGroup')}>
            <Text style={styles.addBtnText}>+ Create or join a group</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  list: { padding: 16 },
  card: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1 },
  groupName: { fontSize: 17, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 2 },
  challenge: { fontSize: 13, color: COLORS.textSecondary },
  streakBadge: { backgroundColor: COLORS.bgElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  streakNum: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  cardBottom: {},
  meta: { fontSize: 12, color: COLORS.textMuted },
  addBtn: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', borderStyle: 'dashed' },
  addBtnText: { fontSize: 15, color: COLORS.textSecondary },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: COLORS.bgPrimary },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28 },
  createBtn: { backgroundColor: COLORS.bgElevated, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 },
  createBtnText: { color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 15 },
});
