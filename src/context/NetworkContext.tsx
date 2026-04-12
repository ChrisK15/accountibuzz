/**
 * NetworkContext.tsx
 * Provides real-time network status to the whole app. Wraps NetworkContext
 * so any component can call useContext(NetworkContext) to check connectivity.
 * Also triggers the offline queue drain when the device comes back online.
 */

import React, { createContext, useContext, useEffect, useRef } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

interface NetworkContextValue {
  isOnline: boolean
}

export const NetworkContext = createContext<NetworkContextValue>({ isOnline: true })

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext)
}

type Props = { children: React.ReactNode }

export function NetworkProvider({ children }: Props) {
  const isOnline = useNetworkStatus()
  // Track the previous online state so we only drain the queue on the
  // false → true transition, not on every re-render.
  const prevOnlineRef = useRef(isOnline)

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current
    const isNowOnline = isOnline

    if (wasOffline && isNowOnline) {
      // Device just came back online — trigger queue drain.
      // The actual drain logic lives in useOfflineQueue, which listens
      // to this context. This effect just logs the transition.
      console.log('[Network] Back online — queue drain will trigger.')
    }

    prevOnlineRef.current = isOnline
  }, [isOnline])

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  )
}
