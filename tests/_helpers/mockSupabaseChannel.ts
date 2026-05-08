// Extracted from tests/submissions/useTodaySubmissionRealtime.test.tsx (lines 51-91)
// for reuse across Phase 4 Realtime hook tests (D-15, D-20, D-21).
// Per 04-PATTERNS.md §"Realtime Channel Lifecycle".
//
// Single canonical channel-chain mock helper. Tests import this instead of
// re-implementing the spy chain inline. Accessor name is `getChannelName`
// (NOT `channelName`) — see 04-REVIEWS.md LOW concern (drift fix).

import type { ComponentType, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

export type RealtimePayload = { new?: unknown; old?: unknown };
export type Handler = (payload: RealtimePayload) => void;

export interface RealtimeFixture {
  qc: QueryClient;
  wrapper: ComponentType<{ children: ReactNode }>;
  channel: jest.Mock;
  on: jest.Mock;
  subscribe: jest.Mock;
  removeChannel: jest.Mock;
  getHandler: () => Handler | null;
  /**
   * Returns the FIRST argument passed to `supabase.channel(...)` (the channel
   * name) or null if `channel()` has not been called. Single canonical accessor.
   */
  getChannelName: () => string | null;
}

interface SupabaseLike {
  channel: unknown;
  removeChannel: unknown;
}

/**
 * Sets up jest spies on `supabase.channel` and `supabase.removeChannel` so
 * Realtime hook tests can:
 *   - assert the channel name + filter passed to `.on('postgres_changes', ...)`
 *   - drive synthetic payloads via the captured handler (`getHandler()`)
 *   - assert teardown via `removeChannel` on unmount
 *
 * Mirrors the production channel chain shape:
 *   supabase.channel(name).on('postgres_changes', config, handler).subscribe()
 */
export function setupChannelMock(supabase: SupabaseLike): RealtimeFixture {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const removeChannel = jest.fn();
  const subscribe = jest.fn(() => ({ unsubscribe: jest.fn() }));
  let capturedHandler: Handler | null = null;
  let capturedChannelName: string | null = null;

  const on = jest.fn().mockImplementation((_event: string, _config: unknown, handler: Handler) => {
    capturedHandler = handler;
    return { subscribe };
  });
  const channel = jest.fn().mockImplementation((name: string) => {
    capturedChannelName = name;
    return { on };
  });
  jest.spyOn(supabase, 'channel' as never).mockImplementation(channel as never);
  jest.spyOn(supabase, 'removeChannel' as never).mockImplementation(removeChannel as never);

  const wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };

  return {
    qc,
    wrapper,
    channel,
    on,
    subscribe,
    removeChannel,
    getHandler: () => capturedHandler,
    getChannelName: () => capturedChannelName,
  };
}
