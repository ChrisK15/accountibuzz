// RED Jest scaffold — useGroupSocialCounts (D-13 / D-15 — Today GroupCard
// social-signal line: posted-today count).
//
// WAVE 0 RED-STATE: this file fails at runtime because the production hook
// does not yet exist. The virtual mock declared below satisfies module
// resolution so `pnpm typecheck` stays green (HIGH #7 mitigation, RESOLVED
// via REVIEWS replan 2026-05-08).
//
// Coverage:
//   1. does not query when groupId is undefined
//   2. calls supabase.rpc('get_today_posted_count', { p_group_id })
//   3. returns the integer count from the RPC (defaulting to 0 when null)
//
// Pattern source: src/features/submissions/usePendingReviewCount.ts (single-arg
// RPC scalar pattern).

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// HIGH #7 (REVIEWS replan 2026-05-08): the virtual jest.mock that 04-01
// scaffolded for typecheck-during-RED is removed in 04-03 once the real
// production module lands.

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = effect();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [effect]);
    },
  };
});

import type { ComponentType, ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeWrapper(): ComponentType<{ children: ReactNode }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const validGroupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('useGroupSocialCounts', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('does not query when groupId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupSocialCounts } = require('../../../src/features/groups/useGroupSocialCounts');
    const { result } = renderHook(() => useGroupSocialCounts(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('calls supabase.rpc(get_today_posted_count, { p_group_id })', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: 3, error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupSocialCounts } = require('../../../src/features/groups/useGroupSocialCounts');
    const { result } = renderHook(() => useGroupSocialCounts(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(rpcSpy).toHaveBeenCalledWith('get_today_posted_count', {
      p_group_id: validGroupId,
    });
  });

  it('returns the integer count from the RPC (defaults to 0 when null)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: null, error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupSocialCounts } = require('../../../src/features/groups/useGroupSocialCounts');
    const { result } = renderHook(() => useGroupSocialCounts(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    // null from RPC must coerce to 0 — the social-signal line renders "0/M"
    // not "null/M" when no member has posted today.
    expect(result.current.data).toBe(0);
  });
});
