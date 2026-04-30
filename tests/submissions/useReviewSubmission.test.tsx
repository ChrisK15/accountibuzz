// Mutation tests for useReviewSubmission. Covers ADM-02/03 + cross-device
// invalidation contract (does NOT invalidate the submitter's today cache).
//
// Test cases:
//   1. approve happy path — invalidates reviewQueue + pendingReviewCount
//   2. reject with reason — RPC payload contains decision='rejected' + reason
//   3. typed error not_admin propagates as Error.message
//   4. invariant: does NOT invalidate ['submission', ...] (Realtime owns that)

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

import type { ComponentType, ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const validGroupId = '22222222-2222-4222-8222-222222222222';
const validSubmissionId = '33333333-3333-4333-8333-333333333333';

function makeWrapper(): { wrapper: ComponentType<{ children: ReactNode }>; client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
  return { wrapper, client };
}

describe('useReviewSubmission', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('approve happy path: invalidates reviewQueue + pendingReviewCount', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: null, error: null } as never);
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewSubmission } = require('../../src/features/submissions/useReviewSubmission');
    const { result } = renderHook(() => useReviewSubmission(validGroupId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        submissionId: validSubmissionId,
        decision: 'approved',
        rejectionReason: null,
      });
    });

    expect(rpcSpy).toHaveBeenCalledWith('review_submission', {
      p_submission_id: validSubmissionId,
      p_decision: 'approved',
      p_rejection_reason: '',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reviewQueue', validGroupId] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['pendingReviewCount', validGroupId],
    });
  });

  it('reject with reason: RPC payload carries decision=rejected + reason', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: null, error: null } as never);
    const { wrapper } = makeWrapper();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewSubmission } = require('../../src/features/submissions/useReviewSubmission');
    const { result } = renderHook(() => useReviewSubmission(validGroupId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        submissionId: validSubmissionId,
        decision: 'rejected',
        rejectionReason: 'Goal not met today',
      });
    });

    expect(rpcSpy).toHaveBeenCalledWith('review_submission', {
      p_submission_id: validSubmissionId,
      p_decision: 'rejected',
      p_rejection_reason: 'Goal not met today',
    });
  });

  it('typed error not_admin propagates as Error.message', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: null, error: { message: 'not_admin' } } as never);
    const { wrapper } = makeWrapper();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewSubmission } = require('../../src/features/submissions/useReviewSubmission');
    const { result } = renderHook(() => useReviewSubmission(validGroupId), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          submissionId: validSubmissionId,
          decision: 'approved',
          rejectionReason: null,
        }),
      ).rejects.toThrow('not_admin');
    });
  });

  it('invariant: does NOT invalidate the submitter\'s ["submission", ...] cache', async () => {
    // Realtime owns that cache update so cross-device flow works (ADM-04 + D-13).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as never);
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewSubmission } = require('../../src/features/submissions/useReviewSubmission');
    const { result } = renderHook(() => useReviewSubmission(validGroupId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        submissionId: validSubmissionId,
        decision: 'approved',
        rejectionReason: null,
      });
    });

    // No invalidateQueries call ever has key starting with 'submission'.
    const submissionInvalidations = invalidateSpy.mock.calls.filter((c) => {
      const arg = c[0] as { queryKey?: unknown[] } | undefined;
      const key = arg?.queryKey;
      return Array.isArray(key) && key[0] === 'submission';
    });
    expect(submissionInvalidations).toHaveLength(0);
  });
});
