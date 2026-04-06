import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Stub — full implementation deferred until group/home screens are built
export default function MainNavigator() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Main App — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 16, color: '#6b7280' },
});
