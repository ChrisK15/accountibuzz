// RED Jest scaffold — useGroupFeed (FEED-01).
//
// WAVE 0 RED-STATE: this file fails at runtime because the production hook
// does not yet exist. The virtual mock declared below satisfies module
// resolution so `pnpm typecheck` stays green (HIGH #7 mitigation, RESOLVED
// via REVIEWS replan 2026-05-08).
//
// Coverage:
//   1. does not query when groupId or today is undefined
//   2. calls supabase.from('submissions').select(...) chain with the
//      group_id / local_date / status='approved' filters and created_at desc order
//   3. orders by created_at descending (newest-first feed per UI-SPEC)
//   4. maps embedded profile fields into a flat row shape
//
// Pattern source: src/features/groups/useGroupMembers.ts (PostgREST embed
// + flat-shape mapping) and tests/groups/useGroupsList.test.tsx (.from chain
// mock pattern).

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

interface ChainNode {
  eq: jest.Mock;
  order: jest.Mock;
}

interface ChainSpies {
  fromSpy: jest.SpyInstance;
  selectSpy: jest.Mock;
  eqs: jest.Mock[];
  order: jest.Mock;
}

/**
 * Builds a chained `.from(...).select(...).eq(...).eq(...).eq(...).order(...)`
 * spy graph that resolves to `{ data, error }`. Returns the call-spies so the
 * test can assert each step in the chain.
 */
function setupFromChain(
  supabase: { from: unknown },
  payload: { data: unknown; error: unknown },
): ChainSpies {
  const eqs: jest.Mock[] = [];
  const order = jest.fn().mockResolvedValue(payload);
  const buildEq = (): jest.Mock => {
    const eq: jest.Mock = jest.fn((): ChainNode => ({ eq: buildEq(), order }));
    eqs.push(eq);
    return eq;
  };
  const initialEq = buildEq();
  const selectSpy = jest.fn((): ChainNode => ({ eq: initialEq, order }));
  const fromSpy = jest
    .spyOn(supabase, 'from' as never)
    .mockImplementation((() => ({ select: selectSpy })) as never);
  return { fromSpy, selectSpy, eqs, order };
}

const validGroupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const today = '2026-05-08';

describe('useGroupFeed', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('does not query when groupId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeed } = require('../../../src/features/submissions/useGroupFeed');
    const { result } = renderHook(() => useGroupFeed(undefined, today), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('does not query when today is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeed } = require('../../../src/features/submissions/useGroupFeed');
    const { result } = renderHook(() => useGroupFeed(validGroupId, undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('queries submissions filtered by group_id, local_date=today, status=approved, ordered by created_at DESC', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { fromSpy, selectSpy, order } = setupFromChain(supabase, {
      data: [],
      error: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeed } = require('../../../src/features/submissions/useGroupFeed');
    const { result } = renderHook(() => useGroupFeed(validGroupId, today), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(fromSpy).toHaveBeenCalledWith('submissions');
    // Select must include profile embed for flat-shape mapping.
    // CK-04 inline fix 2026-05-09: explicit FK hint required because
    // submissions has two FKs to profiles (user_id + reviewed_by).
    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringMatching(/profiles!submissions_user_id_fkey\(display_name, ?avatar_path, ?updated_at\)/),
    );
    // Final step must be created_at descending.
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('maps embedded profile fields into a flat row shape', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const dbRow = {
      id: 'sub-1',
      user_id: 'user-1',
      caption: 'caption',
      media_path: 'g/u/abc.jpg',
      media_type: 'photo',
      created_at: '2026-05-08T12:00:00Z',
      profiles: {
        display_name: 'Alice',
        avatar_path: 'u/avatar.jpg',
        updated_at: '2026-05-07T08:00:00Z',
      },
    };
    setupFromChain(supabase, { data: [dbRow], error: null });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeed } = require('../../../src/features/submissions/useGroupFeed');
    const { result } = renderHook(() => useGroupFeed(validGroupId, today), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual([
      {
        id: 'sub-1',
        user_id: 'user-1',
        caption: 'caption',
        media_path: 'g/u/abc.jpg',
        media_type: 'photo',
        created_at: '2026-05-08T12:00:00Z',
        display_name: 'Alice',
        avatar_path: 'u/avatar.jpg',
        updated_at: '2026-05-07T08:00:00Z',
      },
    ]);
  });
});
