/**
 * useNetworkStatus.ts
 * Subscribes to device network state and returns a boolean indicating whether
 * the device is currently online. Uses ?? true for null safety in strict TS —
 * NetInfo returns null before the first event fires.
 */

import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Get the current state immediately on mount.
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected ?? true)
    })

    // Subscribe to future changes.
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true)
    })

    return unsubscribe
  }, [])

  return isOnline
}
