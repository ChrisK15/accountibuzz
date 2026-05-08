// RED Jest scaffold — useGroupLeaderboard (LB-01).
//
// WAVE 0 RED-STATE: this file fails at runtime because the production hook
// does not yet exist. The virtual mock declared below satisfies module
// resolution so `pnpm typecheck` stays green (HIGH #7 mitigation, RESOLVED
// via REVIEWS replan 2026-05-08). 04-03 will create the real
// `src/features/groups/useGroupLeaderboard.ts`; the test execution then
// flips GREEN against the real RPC contract.
//
// Coverage:
//   1. does not query when groupId is undefined (TanStack `enabled: !!groupId`)
//   2. calls supabase.rpc('get_group_leaderboard', { p_group_id })
//   3. returns rows in the order the RPC delivers them (server-side sort —
//      hook does NOT re-sort)
//   4. surfaces error.message via TanStack error
//
// Pattern source: tests/submissions/useReviewQueue.test.tsx (RPC mock pattern).

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// HIGH #7 (REVIEWS replan 2026-05-08): the virtual jest.mock that 04-01
// scaffolded for typecheck-during-RED is removed in 04-03 once the real
// production module lands — it shadowed the real export and prevented the
// hook from running. This file now imports the real hook lazily via
// require() so each test can wire its own supabase.rpc spy.

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

describe('useGroupLeaderboard', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('does not query when groupId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboard } = require('../../../src/features/groups/useGroupLeaderboard');
    const { result } = renderHook(() => useGroupLeaderboard(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('calls supabase.rpc with get_group_leaderboard and { p_group_id }', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: [], error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboard } = require('../../../src/features/groups/useGroupLeaderboard');
    const { result } = renderHook(() => useGroupLeaderboard(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(rpcSpy).toHaveBeenCalledWith('get_group_leaderboard', {
      p_group_id: validGroupId,
    });
  });

  it('returns rows in the order the RPC delivers (server-side sort)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const rows = [
      {
        user_id: 'u-alice',
        display_name: 'Alice',
        avatar_path: null,
        updated_at: null,
        points: 10,
        current_streak: 5,
        longest_streak: 5,
        last_rolled_date: null,
        joined_at: '2026-01-01T00:00:00Z',
      },
      {
        user_id: 'u-bob',
        display_name: 'Bob',
        avatar_path: null,
        updated_at: null,
        points: 5,
        current_streak: 3,
        longest_streak: 3,
        last_rolled_date: null,
        joined_at: '2026-01-15T00:00:00Z',
      },
      {
        user_id: 'u-carol',
        display_name: 'Carol',
        avatar_path: null,
        updated_at: null,
        points: 5,
        current_streak: 3,
        longest_streak: 3,
        last_rolled_date: null,
        joined_at: '2026-01-20T00:00:00Z',
      },
    ];
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: rows, error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboard } = require('../../../src/features/groups/useGroupLeaderboard');
    const { result } = renderHook(() => useGroupLeaderboard(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual(rows);
  });

  it('surfaces error.message from the RPC', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: null, error: { message: 'not_member' } } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboard } = require('../../../src/features/groups/useGroupLeaderboard');
    const { result } = renderHook(() => useGroupLeaderboard(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('not_member');
  });
});
