import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { saveUserProfile } from '@/services/firebase/authService';
import { auth } from '@/services/firebase/config';
import ErrorBanner from '@/components/common/ErrorBanner';
import { AuthStackParamList } from '@/types/navigation';
import { COLORS } from '@/utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'SetupProfile'>;

export default function SetupProfileScreen(_props: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshProfile } = useAuth();

  async function handleContinue() {
    const user = auth.currentUser;
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await saveUserProfile(user.uid, name);
      await refreshProfile();
    } catch (e) {
      setError('Failed to save your display name. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What should we call you?</Text>
      <Text style={styles.subtitle}>This is how you'll appear to your group.</Text>

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
        style={[styles.button, !name.trim() && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!name.trim() || saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Continue</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: COLORS.bgPrimary },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 32 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.textPrimary, marginBottom: 24 },
  button: { backgroundColor: COLORS.bgElevated, padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
