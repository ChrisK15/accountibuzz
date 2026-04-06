import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/types/navigation';
import Button from '@/components/common/Button';
import { COLORS } from '@/utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>AccountiBuzz</Text>
        <Text style={styles.subtitle}>Hold each other accountable.</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Get started" onPress={() => navigation.navigate('Register')} />
        <Button label="Sign in" onPress={() => navigation.navigate('SignIn')} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  actions: {
    paddingBottom: 8,
  },
});
