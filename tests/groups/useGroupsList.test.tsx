// Representative read-hook test. Other read + mutation hooks share this shape
// (Pattern 1 / 5 in 02-RESEARCH.md) and are exercised end-to-end by the screen
// integration tests shipped in plans 04–06.

// Env must be set before the supabase singleton module loads.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

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

function mockSelect(rows: unknown[], error: { message: string } | null = null) {
  const { supabase } = require('../../src/lib/supabase');
  jest.spyOn(supabase, 'from').mockReturnValue({
    select: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: rows, error }),
    }),
  } as never);
}

describe('useGroupsList', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('returns data shaped as GroupsListRow[] with member_count computed from the inner aggregate', async () => {
    mockSelect([
      {
        id: 'g1',
        name: 'Morning runners',
        goal: 'Post a photo before 9am.',
        submission_type: 'photo',
        timezone: 'America/Los_Angeles',
        admin_user_id: 'u1',
        group_members: [{ count: 5 }],
      },
    ]);
    const { useGroupsList } = require('../../src/features/groups/useGroupsList');
    const { result } = renderHook(() => useGroupsList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual([
      {
        id: 'g1',
        name: 'Morning runners',
        goal: 'Post a photo before 9am.',
        submission_type: 'photo',
        timezone: 'America/Los_Angeles',
        admin_user_id: 'u1',
        member_count: 5,
      },
    ]);
  });

  it('is isPending=true initially and isPending=false after resolve', async () => {
    mockSelect([]);
    const { useGroupsList } = require('../../src/features/groups/useGroupsList');
    const { result } = renderHook(() => useGroupsList(), { wrapper: makeWrapper() });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it('defaults member_count to 0 when the aggregate row is missing', async () => {
    mockSelect([
      {
        id: 'g2',
        name: 'Solo',
        goal: 'just me',
        submission_type: 'video',
        timezone: 'UTC',
        admin_user_id: 'u1',
        // no group_members key
      },
    ]);
    const { useGroupsList } = require('../../src/features/groups/useGroupsList');
    const { result } = renderHook(() => useGroupsList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data?.[0].member_count).toBe(0);
  });

  it('surfaces supabase error via error.message', async () => {
    mockSelect([], { message: 'network down' });
    const { useGroupsList } = require('../../src/features/groups/useGroupsList');
    const { result } = renderHook(() => useGroupsList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('network down');
  });
});
