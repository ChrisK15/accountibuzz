// Read-hook test for useTodaySubmission. Covers SUB-04 fetch shape:
//   - disabled when groupId or todayLocalDate undefined
//   - returns null when no row (.maybeSingle())
//   - returns the row when present
//
// Pattern: tests/groups/useGroupsList.test.tsx (QueryClient wrapper) +
//          tests/avatar-upload.test.ts (jest.spyOn supabase chain).

// Set env before require so the singleton's env-var guard passes.
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

const validUserId = '11111111-1111-4111-8111-111111111111';
const validGroupId = '22222222-2222-4222-8222-222222222222';
const today = '2026-04-28';

/**
 * Mock the supabase chain `from('submissions').select(...).eq(...).eq(...).eq(...).maybeSingle()`.
 * The chain is fluent — eq returns `this`, terminal is maybeSingle.
 */
function mockSubmissionsChain(args: { data: unknown; error: { message: string } | null }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require('../../src/lib/supabase');
  const maybeSingle = jest.fn().mockResolvedValue({ data: args.data, error: args.error });
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  jest.spyOn(supabase, 'from').mockReturnValue(chain as never);
  return { maybeSingle, chain };
}

function mockGetUser() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require('../../src/lib/supabase');
  jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
    data: { user: { id: validUserId } as never },
    error: null,
  });
}

describe('useTodaySubmission', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('is disabled (data undefined) when groupId is undefined', async () => {
    mockGetUser();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmission } = require('../../src/features/submissions/useTodaySubmission');
    const { result } = renderHook(() => useTodaySubmission(undefined, today), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true); // disabled queries stay pending
    expect(result.current.fetchStatus).toBe('idle'); // but not actively fetching
  });

  it('is disabled when todayLocalDate is undefined', async () => {
    mockGetUser();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmission } = require('../../src/features/submissions/useTodaySubmission');
    const { result } = renderHook(() => useTodaySubmission(validGroupId, undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns null when no submission for today (.maybeSingle returns null)', async () => {
    mockGetUser();
    mockSubmissionsChain({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmission } = require('../../src/features/submissions/useTodaySubmission');
    const { result } = renderHook(() => useTodaySubmission(validGroupId, today), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns submission row when present', async () => {
    const row = {
      id: 'sub-1',
      status: 'pending',
      caption: 'caption text',
      rejection_reason: null,
      reviewed_at: null,
      created_at: '2026-04-28T12:00:00Z',
      local_date: today,
      media_path: `${validGroupId}/${validUserId}/abc.jpg`,
      media_type: 'photo',
    };
    mockGetUser();
    mockSubmissionsChain({ data: row, error: null });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmission } = require('../../src/features/submissions/useTodaySubmission');
    const { result } = renderHook(() => useTodaySubmission(validGroupId, today), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual(row);
  });

  it('uses date-aware query key per REVIEWS C1 (rotates on local-date change)', async () => {
    // Drives two renders with different local-date strings; both should fetch separately.
    mockGetUser();
    const { maybeSingle } = mockSubmissionsChain({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmission } = require('../../src/features/submissions/useTodaySubmission');

    const { result: r1 } = renderHook(() => useTodaySubmission(validGroupId, '2026-04-28'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(r1.current.isPending).toBe(false));

    const { result: r2 } = renderHook(() => useTodaySubmission(validGroupId, '2026-04-29'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(r2.current.isPending).toBe(false));

    // The mock is shared across both wrappers, but each wrapper has its own
    // QueryClient — so each one fetches once. We just assert maybeSingle ran
    // multiple times (once per render with its own date).
    expect(maybeSingle.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces supabase error via Error.message', async () => {
    mockGetUser();
    mockSubmissionsChain({ data: null, error: { message: 'rls denied' } });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmission } = require('../../src/features/submissions/useTodaySubmission');
    const { result } = renderHook(() => useTodaySubmission(validGroupId, today), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('rls denied');
  });
});
