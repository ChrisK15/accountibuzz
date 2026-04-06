import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

export default function RootNavigator() {
  const { firebaseUser, profileComplete, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // No Firebase user — show auth flow
  if (!firebaseUser) return <AuthNavigator />;

  // Firebase user exists but profile not set up yet — still show auth stack
  // SetupProfileScreen is inside AuthNavigator; SCRUM-11 will handle routing there
  if (!profileComplete) return <AuthNavigator />;

  return <MainNavigator />;
}
