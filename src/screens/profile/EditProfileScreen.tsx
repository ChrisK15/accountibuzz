import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { updateUserProfile } from '@/services/firebase/authService';
import { auth } from '@/services/firebase/config';
import ErrorBanner from '@/components/common/ErrorBanner';
import { COLORS } from '@/utils/constants';

export default function EditProfileScreen({ navigation }: any) {
  const { userProfile, refreshProfile } = useAuth();
  const [name, setName] = useState(userProfile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const user = auth.currentUser;
    if (!user || !name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await updateUserProfile(user.uid, name);
      await refreshProfile();
      navigation.goBack();
    } catch (e) {
      setError('Failed to update display name. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const unchanged = name.trim() === (userProfile?.displayName ?? '').trim();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Display name</Text>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Display name"
        placeholderTextColor={COLORS.textSecondary}
        maxLength={50}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.button, (unchanged || !name.trim()) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={unchanged || !name.trim() || saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: COLORS.bgPrimary },
  label: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, marginTop: 24, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.textPrimary, marginBottom: 24 },
  button: { backgroundColor: COLORS.bgElevated, padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
