// Read-hook tests for useReviewQueue (ADM-01) + REVIEWS C3 admin-gate RPC path.
//
// Test cases:
//   1. disabled when groupId is undefined
//   2. PER REVIEWS C3: calls get_pending_review_queue RPC (NOT direct table SELECT)
//   3. flattens RPC's profile_updated_at → updated_at on the returned row shape
//   4. handles null profile fields (display_name/avatar_path/profile_updated_at)
//   5. PER REVIEWS C3: propagates `not_admin` typed error from server

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

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

const validGroupId = '22222222-2222-4222-8222-222222222222';

describe('useReviewQueue', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('is disabled (data undefined) when groupId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueue } = require('../../src/features/submissions/useReviewQueue');
    const { result } = renderHook(() => useReviewQueue(undefined), { wrapper: makeWrapper() });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('PER REVIEWS C3: calls get_pending_review_queue RPC, NOT direct table SELECT', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const rpcSpy = jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: [], error: null } as never);
    const fromSpy = jest.spyOn(supabase, 'from');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueue } = require('../../src/features/submissions/useReviewQueue');
    const { result } = renderHook(() => useReviewQueue(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(rpcSpy).toHaveBeenCalledWith('get_pending_review_queue', { p_group_id: validGroupId });
    // No direct table SELECT on submissions (the pre-C3 footgun).
    const submissionsCalls = fromSpy.mock.calls.filter((c) => c[0] === 'submissions');
    expect(submissionsCalls).toHaveLength(0);
  });

  it('flattens RPC profile_updated_at → updated_at on the returned shape', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const rpcRow = {
      id: 'sub-1',
      user_id: 'user-1',
      caption: 'caption',
      media_path: 'g1/u1/abc.jpg',
      media_type: 'photo',
      created_at: '2026-04-28T12:00:00Z',
      display_name: 'Alice',
      avatar_path: 'u1/avatar.jpg',
      profile_updated_at: '2026-04-27T08:00:00Z',
    };
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: [rpcRow], error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueue } = require('../../src/features/submissions/useReviewQueue');
    const { result } = renderHook(() => useReviewQueue(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual([
      {
        id: 'sub-1',
        user_id: 'user-1',
        caption: 'caption',
        media_path: 'g1/u1/abc.jpg',
        media_type: 'photo',
        created_at: '2026-04-28T12:00:00Z',
        display_name: 'Alice',
        avatar_path: 'u1/avatar.jpg',
        updated_at: '2026-04-27T08:00:00Z',
      },
    ]);
  });

  it('handles null profile fields (display_name / avatar_path / profile_updated_at)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const rpcRow = {
      id: 'sub-2',
      user_id: 'user-2',
      caption: null,
      media_path: 'g1/u2/def.mp4',
      media_type: 'video',
      created_at: '2026-04-28T13:00:00Z',
      display_name: null,
      avatar_path: null,
      profile_updated_at: null,
    };
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: [rpcRow], error: null } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueue } = require('../../src/features/submissions/useReviewQueue');
    const { result } = renderHook(() => useReviewQueue(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual([
      {
        id: 'sub-2',
        user_id: 'user-2',
        caption: null,
        media_path: 'g1/u2/def.mp4',
        media_type: 'video',
        created_at: '2026-04-28T13:00:00Z',
        display_name: null,
        avatar_path: null,
        updated_at: null,
      },
    ]);
  });

  it('PER REVIEWS C3: propagates not_admin typed error from server-side gate', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: null, error: { message: 'not_admin' } } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueue } = require('../../src/features/submissions/useReviewQueue');
    const { result } = renderHook(() => useReviewQueue(validGroupId), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('not_admin');
  });
});
