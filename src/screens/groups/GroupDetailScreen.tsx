import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '@/utils/constants';

// Mock data for showcase
const MOCK_MEMBERS = [
  { uid: 'a', displayName: 'Alex', streak: 21, submitted: true },
  { uid: 'b', displayName: 'Jordan', streak: 14, submitted: true },
  { uid: 'c', displayName: 'You', streak: 7, submitted: false },
  { uid: 'd', displayName: 'Casey', streak: 3, submitted: false },
];

export default function GroupDetailScreen({ navigation, route }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.challengeCard}>
        <Text style={styles.challengeLabel}>Today's challenge</Text>
        <Text style={styles.challengeText}>Daily 5k run</Text>
        <Text style={styles.deadline}>Deadline: midnight · 2 of 4 submitted</Text>
      </View>

      <TouchableOpacity style={styles.submitBtn}>
        <Text style={styles.submitBtnText}>Submit proof</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Members</Text>
      {MOCK_MEMBERS.map(m => (
        <View key={m.uid} style={styles.memberRow}>
          <View style={styles.memberLeft}>
            <View style={[styles.dot, m.submitted ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.memberName}>{m.displayName}</Text>
          </View>
          <Text style={styles.memberStreak}>🔥 {m.streak}</Text>
        </View>
      ))}

      <TouchableOpacity
        style={styles.leaderboardBtn}
        onPress={() => navigation.navigate('Leaderboard', { groupId: route.params?.groupId })}
      >
        <Text style={styles.leaderboardBtnText}>View leaderboard →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16 },
  challengeCard: {
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 20, marginBottom: 16,
  },
  challengeLabel: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  challengeText: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  deadline: { fontSize: 13, color: COLORS.textMuted },
  submitBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 28 },
  submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  sectionLabel: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
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
  memberStreak: { fontSize: 14, color: COLORS.textSecondary },
  leaderboardBtn: { marginTop: 8, padding: 14, alignItems: 'center' },
  leaderboardBtnText: { fontSize: 15, color: COLORS.textSecondary },
});
