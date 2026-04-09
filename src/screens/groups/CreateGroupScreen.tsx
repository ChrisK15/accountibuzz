import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '@/utils/constants';

export default function CreateGroupScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a group</Text>
      <Text style={styles.subtitle}>Choose how your group tracks accountability</Text>

      <TouchableOpacity style={styles.modeCard}>
        <Text style={styles.modeIcon}>🏆</Text>
        <View style={styles.modeText}>
          <Text style={styles.modeName}>Competitive</Text>
          <Text style={styles.modeDesc}>Ranked leaderboard — see who's on top</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.modeCard}>
        <Text style={styles.modeIcon}>🤝</Text>
        <View style={styles.modeText}>
          <Text style={styles.modeName}>Collaborative</Text>
          <Text style={styles.modeDesc}>Completion board — everyone wins together</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>Full group creation coming in Phase 3</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 20, marginBottom: 12,
  },
  modeIcon: { fontSize: 28 },
  modeText: { flex: 1 },
  modeName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  modeDesc: { fontSize: 13, color: COLORS.textSecondary },
  comingSoon: { marginTop: 'auto', alignItems: 'center', paddingVertical: 16 },
  comingSoonText: { fontSize: 13, color: COLORS.textMuted },
});
