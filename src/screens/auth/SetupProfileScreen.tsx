import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase/config';
import { AuthContext } from '@/context/AuthContext';
import { AuthStackParamList } from '@/types/navigation';
import { COLORS } from '@/utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'SetupProfile'>;

export default function SetupProfileScreen(_props: Props) {
  // Controlled input — name always reflects what the user has typed
  const [name, setName] = useState('');
  // Track loading state while saving to Firestore
  const [saving, setSaving] = useState(false);
  // refreshProfile tells AuthContext to re-fetch the profile from Firestore
  // which triggers RootNavigator to switch to MainNavigator automatically
  const { refreshProfile } = useContext(AuthContext);

  async function handleContinue() {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    // Save display name to Firestore under the users collection
    // doc(db, 'users', user.uid) → finds/creates the document for this user
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      displayName: name.trim(),
      email: user.email,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // auto-detect timezone
      timezoneAutoDetected: true,
      fcmToken: null,
      notificationIntensity: 'gentle',
    }, { merge: true }); // merge: true means don't overwrite existing fields

    // Refresh profile in context — RootNavigator will auto-navigate to main app
    await refreshProfile();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What should we call you?</Text>
      <Text style={styles.subtitle}>This is how you'll appear to your group.</Text>

      {/* Text input — value is tied to state, every keystroke updates name */}
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Display name"
        placeholderTextColor={COLORS.textSecondary}
        maxLength={50}
        autoFocus
      />

      {/* Button is disabled until the user types something */}
      <TouchableOpacity
        style={[styles.button, !name.trim() && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!name.trim() || saving}
      >
        {/* Show spinner while saving, otherwise show text */}
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Continue</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full screen container, centered content
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: COLORS.bgPrimary },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 32 },
  // Input box with border and padding
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.textPrimary, marginBottom: 24 },
  button: { backgroundColor: COLORS.bgElevated, padding: 16, borderRadius: 8, alignItems: 'center' },
  // Faded when disabled (name is empty)
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
