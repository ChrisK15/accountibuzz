import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';
import RootNavigator from '../navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <NetworkProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </NetworkProvider>
    </AuthProvider>
  );
}
