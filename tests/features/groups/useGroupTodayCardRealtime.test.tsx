// Jest tests — useGroupTodayCardRealtime (D-15).
//
// Coverage (per 04-03-PLAN.md Task 2 §Test file 2):
//   1. subscribes with channel name `todaycard:{userId}:{groupId}` on
//      group_members table with event UPDATE
//   2. invalidates ['todaySocialCounts', groupId] on UPDATE event for ANY
//      member (the social-signal counter on the Today GroupCard reflects
//      group-wide member-counter mutations)
//   3. also invalidates ['groupLeaderboard', groupId] when payload.new.user_id
//      === userId (own-row stats refresh on the Today surface)
//   4. does NOT subscribe when groupId or userId is undefined
//   5. cleans up channel on unmount via removeChannel
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

const validGroupId = 'group-1';
const validUserId = 'user-1';
const otherUserId = 'user-2';

describe('useGroupTodayCardRealtime', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it("subscribes with channel name 'todaycard:{userId}:{groupId}' on group_members UPDATE", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, on, getChannelName } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTodayCardRealtime } = require('../../../src/features/groups/useGroupTodayCardRealtime');

    renderHook(() => useGroupTodayCardRealtime(validGroupId, validUserId), {
      wrapper,
    });

    expect(getChannelName()).toBe(`todaycard:${validUserId}:${validGroupId}`);
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${validGroupId}`,
      }),
      expect.any(Function),
    );
  });

  it("invalidates ['todaySocialCounts', groupId] on UPDATE for ANY member", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTodayCardRealtime } = require('../../../src/features/groups/useGroupTodayCardRealtime');
    renderHook(() => useGroupTodayCardRealtime(validGroupId, validUserId), {
      wrapper,
    });

    const handler = getHandler()!;
    // UPDATE for OTHER user — still invalidates social counts.
    act(() =>
      handler({
        new: {
          group_id: validGroupId,
          user_id: otherUserId,
          points: 5,
        },
      }),
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['todaySocialCounts', validGroupId],
    });
  });

  it("also invalidates ['groupLeaderboard', groupId] when payload.new.user_id === userId", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTodayCardRealtime } = require('../../../src/features/groups/useGroupTodayCardRealtime');
    renderHook(() => useGroupTodayCardRealtime(validGroupId, validUserId), {
      wrapper,
    });

    const handler = getHandler()!;
    // UPDATE for THIS user — invalidates BOTH cache keys.
    act(() =>
      handler({
        new: {
          group_id: validGroupId,
          user_id: validUserId,
          points: 7,
        },
      }),
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['todaySocialCounts', validGroupId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['groupLeaderboard', validGroupId],
    });
  });

  it('does NOT subscribe when groupId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, channel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTodayCardRealtime } = require('../../../src/features/groups/useGroupTodayCardRealtime');

    renderHook(() => useGroupTodayCardRealtime(undefined, validUserId), {
      wrapper,
    });

    expect(channel).not.toHaveBeenCalled();
  });

  it('does NOT subscribe when userId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, channel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTodayCardRealtime } = require('../../../src/features/groups/useGroupTodayCardRealtime');

    renderHook(() => useGroupTodayCardRealtime(validGroupId, undefined), {
      wrapper,
    });

    expect(channel).not.toHaveBeenCalled();
  });

  it('cleans up channel on unmount via removeChannel', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, removeChannel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupTodayCardRealtime } = require('../../../src/features/groups/useGroupTodayCardRealtime');

    const { unmount } = renderHook(
      () => useGroupTodayCardRealtime(validGroupId, validUserId),
      { wrapper },
    );
    unmount();

    expect(removeChannel).toHaveBeenCalled();
  });
});
