import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/utils/constants';

// Mock data for showcase — will be driven by Firestore in Phase 5
const MOCK_ENTRIES = [
  { uid: 'a', displayName: 'Alex', streak: 21, submitted: true },
  { uid: 'b', displayName: 'Jordan', streak: 14, submitted: true },
  { uid: 'c', displayName: 'You', streak: 7, submitted: false },
  { uid: 'd', displayName: 'Casey', streak: 3, submitted: false },
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { userProfile } = useAuth();

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_ENTRIES}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.header}>Today's standings</Text>
        }
        renderItem={({ item, index }) => {
          const isMe = item.displayName === 'You';
          return (
            <View style={[styles.row, isMe && styles.rowHighlight]}>
              <Text style={styles.rank}>
                {index < 3 ? MEDALS[index] : `#${index + 1}`}
              </Text>
              <View style={styles.info}>
                <Text style={[styles.name, isMe && styles.nameMe]}>
                  {isMe ? (userProfile?.displayName ?? 'You') : item.displayName}
                </Text>
                <Text style={styles.meta}>{item.submitted ? 'Submitted today' : 'Not yet submitted'}</Text>
              </View>
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {item.streak}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  list: { padding: 16 },
  header: { fontSize: 13, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
  },
  rowHighlight: { borderColor: COLORS.success },
  rank: { fontSize: 20, width: 36 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  nameMe: { color: COLORS.success },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  streakBadge: { backgroundColor: COLORS.bgElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  streakText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
});
