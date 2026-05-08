// Jest tests — useGroupFeedRealtime (FEED-01 / D-21).
//
// Coverage (per 04-03-PLAN.md Task 2 §Test file 1):
//   1. subscribes with channel name `group-feed:{groupId}` and filter
//      `group_id=eq.{groupId}` on submissions table with event '*'
//   2. does NOT subscribe when groupId or groupTimezone is undefined
//   3. IGNORES events whose local_date is not today's local_date in the group
//      timezone (HIGH #2: requires payload.old per replica identity full from
//      04-02; without it the flippedFromApproved branch would fire on every
//      event)
//   4. IGNORES events where neither new.status === 'approved' nor old.status
//      === 'approved' (no-op transitions)
//   5. INVALIDATES ['groupFeed', groupId, today] AND ['groupLeaderboard',
//      groupId] on flip-to-approved — HIGH #8 MVP path; assert NO
//      qc.setQueryData was called for the feed cache (the MVP path is
//      invalidation, NOT optimistic prepend).
//   6. removes the row from feed cache via setQueryData on flip-from-approved
//      — direct removal is safe because no profile-enrichment is needed for
//      a delete.
//   7. cleans up channel on unmount via removeChannel
//
// Pattern source: tests/submissions/useTodaySubmissionRealtime.test.tsx
// (canonical Realtime channel mock pattern via setupChannelMock).

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

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

import { renderHook, act } from '@testing-library/react-native';
import { setupChannelMock } from '../../_helpers/mockSupabaseChannel';

const validGroupId = 'abc-123';
// 'America/Los_Angeles' so todayLocalDate(tz, fakeNow=2026-05-08T08:00Z) =
// '2026-05-08' deterministically (08:00 UTC = 01:00 PDT = same day).
const validTimezone = 'America/Los_Angeles';

describe('useGroupFeedRealtime', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T08:00:00Z'));
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("subscribes with channel name 'group-feed:{groupId}' and filter 'group_id=eq.{groupId}' on submissions", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, on, getChannelName } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');

    renderHook(() => useGroupFeedRealtime(validGroupId, validTimezone), {
      wrapper,
    });

    expect(getChannelName()).toBe(`group-feed:${validGroupId}`);
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: `group_id=eq.${validGroupId}`,
      }),
      expect.any(Function),
    );
  });

  it('does NOT subscribe when groupId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, channel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');

    renderHook(() => useGroupFeedRealtime(undefined, validTimezone), { wrapper });

    expect(channel).not.toHaveBeenCalled();
  });

  it('does NOT subscribe when groupTimezone is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, channel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');

    renderHook(() => useGroupFeedRealtime(validGroupId, undefined), { wrapper });

    expect(channel).not.toHaveBeenCalled();
  });

  it("IGNORES events whose local_date is not today's local_date in the group timezone", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const setQueryDataSpy = jest.spyOn(qc, 'setQueryData');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');
    renderHook(() => useGroupFeedRealtime(validGroupId, validTimezone), {
      wrapper,
    });

    const handler = getHandler()!;
    // local_date = yesterday — must be ignored
    act(() =>
      handler({
        new: {
          group_id: validGroupId,
          user_id: 'u-alice',
          local_date: '2026-05-07', // yesterday in PDT
          status: 'approved',
          id: 'sub-1',
        },
        old: {
          status: 'pending',
        },
      }),
    );

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });

  it("IGNORES events where neither new.status === 'approved' nor old.status === 'approved'", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const setQueryDataSpy = jest.spyOn(qc, 'setQueryData');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');
    renderHook(() => useGroupFeedRealtime(validGroupId, validTimezone), {
      wrapper,
    });

    const handler = getHandler()!;
    // pending → rejected (no approved on either side) — must be ignored
    act(() =>
      handler({
        new: {
          group_id: validGroupId,
          user_id: 'u-alice',
          local_date: '2026-05-08',
          status: 'rejected',
          id: 'sub-1',
        },
        old: {
          status: 'pending',
        },
      }),
    );

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });

  it("INVALIDATES ['groupFeed', groupId, today] AND ['groupLeaderboard', groupId] on flip-to-approved (NOT setQueryData — HIGH #8 MVP path)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    // Pre-populate caches.
    qc.setQueryData(['groupFeed', validGroupId, '2026-05-08'], []);
    qc.setQueryData(['groupLeaderboard', validGroupId], []);
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const setQueryDataSpy = jest.spyOn(qc, 'setQueryData');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');
    renderHook(() => useGroupFeedRealtime(validGroupId, validTimezone), {
      wrapper,
    });

    const handler = getHandler()!;
    // pending → approved — flip-to-approved
    act(() =>
      handler({
        new: {
          group_id: validGroupId,
          user_id: 'u-alice',
          local_date: '2026-05-08',
          status: 'approved',
          id: 'sub-1',
        },
        old: {
          status: 'pending',
        },
      }),
    );

    // Both invalidations must fire.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['groupFeed', validGroupId, '2026-05-08'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['groupLeaderboard', validGroupId],
    });
    // HIGH #8 GATE: NO setQueryData was called for the feed cache on
    // flip-to-approved. The MVP path is invalidation, NOT optimistic prepend.
    const feedSetCalls = setQueryDataSpy.mock.calls.filter(
      (call) =>
        Array.isArray(call[0]) &&
        call[0][0] === 'groupFeed' &&
        call[0][1] === validGroupId,
    );
    expect(feedSetCalls).toHaveLength(0);
  });

  it('removes the row from feed cache via setQueryData on flip-from-approved', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);

    // Pre-populate the feed cache with two rows including 'sub-X'.
    const initialFeed = [
      {
        id: 'sub-X',
        user_id: 'u-alice',
        caption: null,
        media_path: 'p/X.jpg',
        media_type: 'photo' as const,
        created_at: '2026-05-08T07:00:00Z',
        display_name: 'Alice',
        avatar_path: null,
        updated_at: null,
      },
      {
        id: 'sub-Y',
        user_id: 'u-bob',
        caption: null,
        media_path: 'p/Y.jpg',
        media_type: 'photo' as const,
        created_at: '2026-05-08T06:00:00Z',
        display_name: 'Bob',
        avatar_path: null,
        updated_at: null,
      },
    ];
    qc.setQueryData(['groupFeed', validGroupId, '2026-05-08'], initialFeed);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');
    renderHook(() => useGroupFeedRealtime(validGroupId, validTimezone), {
      wrapper,
    });

    const handler = getHandler()!;
    // approved → rejected — flip-from-approved
    act(() =>
      handler({
        new: {
          group_id: validGroupId,
          user_id: 'u-alice',
          local_date: '2026-05-08',
          status: 'rejected',
          id: 'sub-X',
        },
        old: {
          status: 'approved',
        },
      }),
    );

    const patched = qc.getQueryData<typeof initialFeed>([
      'groupFeed',
      validGroupId,
      '2026-05-08',
    ]);
    expect(patched).toBeDefined();
    expect(patched?.find((r) => r.id === 'sub-X')).toBeUndefined();
    expect(patched?.find((r) => r.id === 'sub-Y')).toBeDefined();
  });

  it('cleans up channel on unmount via removeChannel', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, removeChannel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupFeedRealtime } = require('../../../src/features/submissions/useGroupFeedRealtime');

    const { unmount } = renderHook(
      () => useGroupFeedRealtime(validGroupId, validTimezone),
      { wrapper },
    );
    unmount();

    expect(removeChannel).toHaveBeenCalled();
  });
});
