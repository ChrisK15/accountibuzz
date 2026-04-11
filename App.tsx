/**
 * App.tsx
 * Root of the app. Wraps everything in NavigationContainer (required by React
 * Navigation) and AuthContext (provides the signed-in user to all screens).
 * The linking prop enables deep links — tapping accountibuzz:// URLs opens the
 * right screen automatically.
 */

import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '@/context/AuthContext'
import { NetworkProvider } from '@/context/NetworkContext'
import RootNavigator from '@/navigation/RootNavigator'
import { linking } from '@/navigation/linking'

export default function App() {
  return (
    <AuthProvider>
      <NetworkProvider>
        <NavigationContainer linking={linking}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </NetworkProvider>
    </AuthProvider>
  )
}
