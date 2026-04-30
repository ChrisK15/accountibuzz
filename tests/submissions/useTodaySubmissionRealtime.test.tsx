// Realtime hook tests — per-test channel-chain mock pattern.
//
// We mock supabase.channel(...).on(...).subscribe() to capture the handler
// and drive synthetic payloads in-memory. supabase.removeChannel is also
// mocked so we can assert teardown on unmount.
//
// Coverage:
//   1. subscribes with user_id=eq.{userId} filter on focus
//   2. does NOT subscribe when userId is undefined
//   3. patches cache via setQueryData on INSERT events for TODAY
//   4. patches cache on UPDATE events for TODAY (rescoped ADM-04 — review
//      notification cross-device)
//   5. PER REVIEWS C1: IGNORES events whose local_date is yesterday
//   6. PER REVIEWS C1: IGNORES events whose local_date is tomorrow
//   7. PER REVIEWS C1: IGNORES events for groups not in the active tz map
//   8. cleans up channel on unmount via removeChannel

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

// Mock expo-router so we don't pull in @react-navigation/native (which requires
// the full react-native runtime that we mocked out above). useFocusEffect is
// invoked synchronously on mount + its return value is invoked on unmount —
// matching the production semantics for this hook (per RESEARCH §What Should
// NOT Be Mocked line 1585: jest-expo runs useFocusEffect synchronously).
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      // Invoke on mount, store cleanup, return cleanup on unmount via useEffect.
      React.useEffect(() => {
        const cleanup = effect();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [effect]);
    },
  };
});

import type { ComponentType, ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type RealtimePayload = { new?: unknown; old?: unknown };
type Handler = (payload: RealtimePayload) => void;

interface RealtimeFixture {
  qc: QueryClient;
  wrapper: ComponentType<{ children: ReactNode }>;
  channel: jest.Mock;
  on: jest.Mock;
  subscribe: jest.Mock;
  removeChannel: jest.Mock;
  getHandler: () => Handler | null;
}

function setup(): RealtimeFixture {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require('../../src/lib/supabase');

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const removeChannel = jest.fn();
  const subscribe = jest.fn(() => ({ unsubscribe: jest.fn() }));
  let capturedHandler: Handler | null = null;

  const on = jest.fn().mockImplementation((_event: string, _config: unknown, handler: Handler) => {
    capturedHandler = handler;
    return { subscribe };
  });
  const channel = jest.fn().mockReturnValue({ on });
  jest.spyOn(supabase, 'channel').mockImplementation(channel as never);
  jest.spyOn(supabase, 'removeChannel').mockImplementation(removeChannel as never);

  const wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

  return {
    qc,
    wrapper,
    channel,
    on,
    subscribe,
    removeChannel,
    getHandler: () => capturedHandler,
  };
}

function makeTzGetter(groupId: string, tz: string): () => Map<string, string> {
  return () => new Map([[groupId, tz]]);
}

// Mirror src/features/submissions/time.ts#todayLocalDate so we can build a
// "today" string without coupling the test to an exported helper.
function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

describe('useTodaySubmissionRealtime', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('subscribes with user_id filter on focus', () => {
    const { wrapper, channel, on } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    renderHook(() => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')), { wrapper });

    expect(channel).toHaveBeenCalledWith('today-submissions:user-1');
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: 'user_id=eq.user-1',
      }),
      expect.any(Function),
    );
  });

  it('does NOT subscribe when userId is undefined', () => {
    const { wrapper, channel } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    renderHook(
      () => useTodaySubmissionRealtime(undefined, makeTzGetter('g-1', 'UTC')),
      { wrapper },
    );
    expect(channel).not.toHaveBeenCalled();
  });

  it('patches cache via setQueryData on INSERT event for TODAY', () => {
    const { qc, wrapper, getHandler } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    renderHook(() => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')), { wrapper });

    const handler = getHandler()!;
    const today = todayInTz('UTC');
    const row = { group_id: 'g-1', local_date: today, status: 'pending', id: 's-1' };
    act(() => handler({ new: row }));

    // PER REVIEWS C1: cache key is date-aware (matches useTodaySubmission key shape).
    expect(qc.getQueryData(['submission', 'g-1', today])).toEqual(row);
  });

  it('patches cache on UPDATE event for TODAY (rescoped ADM-04 — review notification)', () => {
    const { qc, wrapper, getHandler } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    renderHook(() => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')), { wrapper });

    const handler = getHandler()!;
    const today = todayInTz('UTC');
    const row = {
      group_id: 'g-1',
      local_date: today,
      status: 'rejected',
      id: 's-1',
      rejection_reason: 'not today',
    };
    act(() => handler({ new: row }));

    expect(qc.getQueryData(['submission', 'g-1', today])).toEqual(row);
  });

  it('PER REVIEWS C1: IGNORES events whose local_date is yesterday', () => {
    const { qc, wrapper, getHandler } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    renderHook(() => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')), { wrapper });

    const handler = getHandler()!;
    const yesterday = '2020-01-01'; // arbitrarily-not-today
    const row = { group_id: 'g-1', local_date: yesterday, status: 'approved', id: 's-old' };
    act(() => handler({ new: row }));

    // The today cache must NOT be polluted with the yesterday event.
    expect(qc.getQueryData(['submission', 'g-1', todayInTz('UTC')])).toBeUndefined();
    // And the yesterday key must NOT exist either (we only narrow to today events).
    expect(qc.getQueryData(['submission', 'g-1', yesterday])).toBeUndefined();
  });

  it('PER REVIEWS C1: IGNORES events whose local_date is tomorrow', () => {
    const { qc, wrapper, getHandler } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    renderHook(() => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')), { wrapper });

    const handler = getHandler()!;
    const tomorrow = '2099-12-31';
    const row = { group_id: 'g-1', local_date: tomorrow, status: 'pending', id: 's-future' };
    act(() => handler({ new: row }));

    expect(qc.getQueryData(['submission', 'g-1', todayInTz('UTC')])).toBeUndefined();
    expect(qc.getQueryData(['submission', 'g-1', tomorrow])).toBeUndefined();
  });

  it('PER REVIEWS C1: IGNORES events for groups not in the active tz map', () => {
    const { qc, wrapper, getHandler } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    // Tz map only knows g-1; the event arrives for g-2 (user joined a different group?).
    renderHook(() => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')), { wrapper });

    const handler = getHandler()!;
    const today = todayInTz('UTC');
    const row = { group_id: 'g-2', local_date: today, status: 'pending', id: 's-x' };
    act(() => handler({ new: row }));

    expect(qc.getQueryData(['submission', 'g-2', today])).toBeUndefined();
  });

  it('cleans up channel on unmount via removeChannel', () => {
    const { wrapper, removeChannel } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    const { unmount } = renderHook(
      () => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')),
      { wrapper },
    );
    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });

  it('falls back to payload.old when payload.new is missing (DELETE shape)', () => {
    const { qc, wrapper, getHandler } = setup();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTodaySubmissionRealtime } = require('../../src/features/submissions/useTodaySubmissionRealtime');

    renderHook(() => useTodaySubmissionRealtime('user-1', makeTzGetter('g-1', 'UTC')), { wrapper });

    const handler = getHandler()!;
    const today = todayInTz('UTC');
    const row = { group_id: 'g-1', local_date: today, status: 'pending', id: 's-old' };
    act(() => handler({ old: row }));

    expect(qc.getQueryData(['submission', 'g-1', today])).toEqual(row);
  });
});
