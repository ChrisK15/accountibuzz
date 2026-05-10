// Realtime hook tests for useReviewQueueRealtime — channel-chain mock pattern
// (1:1 with tests/submissions/useTodaySubmissionRealtime.test.tsx).
//
// Q1 RESOLUTION (channel-naming): the hook MUST use distinct channel names
// per mount point — `review-queue:{groupId}:{mountPoint}`. This test file
// asserts the `'badge'` mountPoint variant explicitly; the matching
// `'list'` variant is wired at the review-screen mount site (Plan 03.1-01
// Task 4). See `.planning/phases/03.1-p3-polish-realtime-hardening/
// 03.1-RESEARCH.md §Q1` for the supabase-js Discussion #27142 / Issue #1440
// rationale.
//
// Coverage (6 cases per RESEARCH §Code Examples §5):
//   1. subscribes with channel name `review-queue:g-1:badge` and filter
//      `group_id=eq.g-1` on focus
//   2. does NOT subscribe when groupId is undefined (admin-gate short-circuit)
//   3. invalidates BOTH `['reviewQueue', 'g-1']` AND `['pendingReviewCount',
//      'g-1']` on INSERT (status='pending', no `old`)
//   4. invalidates BOTH on UPDATE where oldRow.status='pending' (review just
//      happened, so the badge must drop the count and the list must drop the row)
//   5. IGNORES events that don't touch the pending set (e.g. approved → rejected
//      of an already-reviewed row — neither old nor new is pending)
//   6. cleans up channel on unmount via `removeChannel`

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

// Mock expo-router so we don't pull in @react-navigation/native (which requires
// the full react-native runtime that we mocked out above). useFocusEffect is
// invoked synchronously on mount + its return value is invoked on unmount —
// matching the production semantics for this hook (per RESEARCH §What Should
// NOT Be Mocked: jest-expo runs useFocusEffect synchronously).
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

import { renderHook, act } from '@testing-library/react-native';
import { setupChannelMock } from '../_helpers/mockSupabaseChannel';

describe('useReviewQueueRealtime', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('subscribes with channel name review-queue:g-1:badge and filter group_id=eq.g-1 on focus', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const { wrapper, channel, on, subscribe } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueueRealtime } = require('../../src/features/submissions/useReviewQueueRealtime');

    renderHook(() => useReviewQueueRealtime('g-1', 'badge'), { wrapper });

    expect(channel).toHaveBeenCalledWith('review-queue:g-1:badge');
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: 'group_id=eq.g-1',
      }),
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalled();
  });

  it('does NOT subscribe when groupId is undefined (admin-gate short-circuit)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const { wrapper, channel, subscribe } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueueRealtime } = require('../../src/features/submissions/useReviewQueueRealtime');

    renderHook(() => useReviewQueueRealtime(undefined, 'badge'), { wrapper });

    expect(channel).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('invalidates BOTH reviewQueue AND pendingReviewCount on INSERT with status=pending', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    const invSpy = jest.spyOn(qc, 'invalidateQueries');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueueRealtime } = require('../../src/features/submissions/useReviewQueueRealtime');

    renderHook(() => useReviewQueueRealtime('g-1', 'badge'), { wrapper });

    const handler = getHandler()!;
    act(() => handler({ new: { status: 'pending', id: 's-1' } }));

    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['reviewQueue', 'g-1'] });
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['pendingReviewCount', 'g-1'] });
  });

  it('invalidates BOTH on UPDATE where oldRow.status=pending and newRow.status=approved (review just happened)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    const invSpy = jest.spyOn(qc, 'invalidateQueries');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueueRealtime } = require('../../src/features/submissions/useReviewQueueRealtime');

    renderHook(() => useReviewQueueRealtime('g-1', 'badge'), { wrapper });

    const handler = getHandler()!;
    act(() =>
      handler({
        old: { status: 'pending' },
        new: { status: 'approved', id: 's-1' },
      }),
    );

    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['reviewQueue', 'g-1'] });
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['pendingReviewCount', 'g-1'] });
  });

  it('IGNORES events that do not touch the pending set (e.g. approved -> rejected on already-reviewed row)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    const invSpy = jest.spyOn(qc, 'invalidateQueries');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueueRealtime } = require('../../src/features/submissions/useReviewQueueRealtime');

    renderHook(() => useReviewQueueRealtime('g-1', 'badge'), { wrapper });

    const handler = getHandler()!;
    const before = invSpy.mock.calls.length;
    act(() =>
      handler({
        old: { status: 'approved' },
        new: { status: 'rejected', id: 's-1' },
      }),
    );

    expect(invSpy.mock.calls.length).toBe(before);
  });

  it('cleans up channel on unmount via removeChannel', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const { wrapper, removeChannel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useReviewQueueRealtime } = require('../../src/features/submissions/useReviewQueueRealtime');

    const { unmount } = renderHook(
      () => useReviewQueueRealtime('g-1', 'badge'),
      { wrapper },
    );
    unmount();

    expect(removeChannel).toHaveBeenCalled();
  });
});
