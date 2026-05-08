// RED Jest scaffold — useGroupTombstones (FEED-02 / FEED-03 combined).
//
// WAVE 0 RED-STATE: this file fails at runtime because the production hook
// does not yet exist. The virtual mock declared below satisfies module
// resolution so `pnpm typecheck` stays green (HIGH #7 mitigation, RESOLVED
// via REVIEWS replan 2026-05-08).
//
// Coverage:
//   1. does not query when groupId is undefined
//   2. today scope calls supabase.rpc('get_pending_today', { p_group_id })
//   3. yesterday scope calls supabase.rpc('get_missed_yesterday', { p_group_id })
//   4. returns the locked shape `{ pendingToday, missedYesterday, isPending,
//      error }` (MEDIUM #3 — RESOLVED via REVIEWS replan 2026-05-08; this is
//      the canonical shape pinned in 04-03 — NOT data.pendingToday, NOT
//      { today, yesterday })
//
// Pattern source: src/features/submissions/usePendingReviewCount.ts (single-arg
// RPC) and 04-PATTERNS.md §"useGroupTombstones".

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// HIGH #7 (REVIEWS replan 2026-05-08): virtual-mock the not-yet-existing
// module so `pnpm typecheck` stays green. 04-03 will create the real module.
jest.mock(
  '../../../src/features/groups/useGroupTombstones',
  () => ({
    useGroupTombstones: jest.fn(),
  }),
  { virtual: true },
);

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

describe('useGroupTombstones', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('does not query when groupId is undefined', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: [], error: null } as never);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTombstones } = require('../../../src/features/groups/useGroupTombstones');

    renderHook(() => useGroupTombstones(undefined), { wrapper: makeWrapper() });

    // Allow microtasks to flush so any unintended fetch would have started.
    await new Promise((r) => setTimeout(r, 0));
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('today scope calls supabase.rpc(get_pending_today, { p_group_id })', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: [], error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTombstones } = require('../../../src/features/groups/useGroupTombstones');
    const { result } = renderHook(() => useGroupTombstones(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(rpcSpy).toHaveBeenCalledWith('get_pending_today', {
      p_group_id: validGroupId,
    });
  });

  it('yesterday scope calls supabase.rpc(get_missed_yesterday, { p_group_id })', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: [], error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTombstones } = require('../../../src/features/groups/useGroupTombstones');
    const { result } = renderHook(() => useGroupTombstones(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(rpcSpy).toHaveBeenCalledWith('get_missed_yesterday', {
      p_group_id: validGroupId,
    });
  });

  it('returns the locked shape { pendingToday, missedYesterday, isPending, error } (MEDIUM #3 pinned)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const pendingTodayRows = [
      {
        user_id: 'u-derek',
        display_name: 'Derek',
        avatar_path: null,
        updated_at: null,
      },
    ];
    const missedYesterdayRows = [
      {
        user_id: 'u-bob',
        display_name: 'Bob',
        avatar_path: null,
        updated_at: null,
      },
    ];
    jest.spyOn(supabase, 'rpc').mockImplementation(((rpcName: string) => {
      if (rpcName === 'get_pending_today') {
        return Promise.resolve({ data: pendingTodayRows, error: null });
      }
      if (rpcName === 'get_missed_yesterday') {
        return Promise.resolve({ data: missedYesterdayRows, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }) as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTombstones } = require('../../../src/features/groups/useGroupTombstones');
    const { result } = renderHook(() => useGroupTombstones(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    // MEDIUM #3 LOCKED SHAPE — the hook returns these four fields directly,
    // NOT nested under `data` and NOT `{ today, yesterday }`.
    expect(result.current).toEqual(
      expect.objectContaining({
        pendingToday: pendingTodayRows,
        missedYesterday: missedYesterdayRows,
        isPending: expect.any(Boolean),
        error: null,
      }),
    );
  });
});
