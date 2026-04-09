import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/utils/constants';

export default function ProfileScreen({ navigation }: any) {
  const { userProfile, signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>
          {userProfile?.displayName?.charAt(0).toUpperCase() ?? '?'}
        </Text>
      </View>

      <Text style={styles.displayName}>{userProfile?.displayName ?? '—'}</Text>
      <Text style={styles.email}>{userProfile?.email ?? ''}</Text>

      {/* Streak card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Current streak</Text>
        <Text style={styles.streakValue}>🔥 0 days</Text>
        <Text style={styles.cardHint}>Submit your first proof to start your streak</Text>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.rowLabel}>Edit display name</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => {}}>
          <Text style={styles.rowLabel}>Notification settings</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 24, alignItems: 'center' },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.textPrimary },
  displayName: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  email: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 },
  card: {
    width: '100%', backgroundColor: COLORS.bgSurface,
    borderRadius: 12, padding: 20, marginBottom: 24, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardLabel: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  streakValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  cardHint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  section: {
    width: '100%', backgroundColor: COLORS.bgSurface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  rowLabel: { fontSize: 15, color: COLORS.textPrimary },
  chevron: { fontSize: 20, color: COLORS.textMuted },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  signOutBtn: { paddingVertical: 14, paddingHorizontal: 32 },
  signOutText: { fontSize: 15, color: COLORS.error, fontWeight: '600' },
});
