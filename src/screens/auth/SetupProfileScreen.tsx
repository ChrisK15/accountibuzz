import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/types/navigation';
import { COLORS } from '@/utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'SetupProfile'>;

// Stub — full implementation in SCRUM-11
export default function SetupProfileScreen(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Set Up Profile — coming in SCRUM-11</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  text: { fontSize: 16, color: COLORS.textSecondary },
});
