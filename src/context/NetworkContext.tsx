import React, { createContext } from 'react';

interface NetworkContextValue {
  isOnline: boolean;
}

export const NetworkContext = createContext<NetworkContextValue>({ isOnline: true });

// Stub provider — full implementation (useNetworkStatus integration) deferred
export function NetworkProvider({ children }: { children: React.ReactNode }) {
  return (
    <NetworkContext.Provider value={{ isOnline: true }}>
      {children}
    </NetworkContext.Provider>
  );
}
