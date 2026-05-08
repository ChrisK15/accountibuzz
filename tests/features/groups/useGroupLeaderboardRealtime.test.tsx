// RED Jest scaffold — useGroupLeaderboardRealtime (LB-02 / D-20).
//
// WAVE 0 RED-STATE: this file fails at runtime because the production hook
// does not yet exist. The virtual mock declared below satisfies module
// resolution so `pnpm typecheck` stays green (HIGH #7 mitigation, RESOLVED
// via REVIEWS replan 2026-05-08).
//
// Coverage:
//   1. subscribes with channel name `group-lb:{groupId}`
//   2. subscribes with filter `group_id=eq.{groupId}` on table `group_members`
//      with event `UPDATE` (per 04-PATTERNS §"useGroupLeaderboardRealtime")
//   3. does NOT subscribe when groupId is undefined
//   4. patches the leaderboard cache via setQueryData on UPDATE event
//   5. cleans up channel on unmount via removeChannel
//
// Pattern source: tests/submissions/useTodaySubmissionRealtime.test.tsx
// (canonical Realtime channel mock pattern via setupChannelMock).

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

import { renderHook, act } from '@testing-library/react-native';
import { setupChannelMock } from '../../_helpers/mockSupabaseChannel';

const validGroupId = 'abc-123';

describe('useGroupLeaderboardRealtime', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.restoreAllMocks();
  });

  it('subscribes with channel name `group-lb:{groupId}`', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, getChannelName } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboardRealtime } = require('../../../src/features/groups/useGroupLeaderboardRealtime');

    renderHook(() => useGroupLeaderboardRealtime(validGroupId), { wrapper });

    expect(getChannelName()).toBe(`group-lb:${validGroupId}`);
  });

  it('subscribes with filter `group_id=eq.{groupId}` on group_members UPDATE', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, on } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboardRealtime } = require('../../../src/features/groups/useGroupLeaderboardRealtime');

    renderHook(() => useGroupLeaderboardRealtime(validGroupId), { wrapper });

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

  it('does NOT subscribe when groupId is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, channel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboardRealtime } = require('../../../src/features/groups/useGroupLeaderboardRealtime');

    renderHook(() => useGroupLeaderboardRealtime(undefined), { wrapper });

    expect(channel).not.toHaveBeenCalled();
  });

  it('patches the leaderboard cache via setQueryData on UPDATE event', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { qc, wrapper, getHandler } = setupChannelMock(supabase);

    // Pre-seed the leaderboard cache with two rows.
    const initialRows = [
      {
        user_id: 'u-alice',
        display_name: 'Alice',
        avatar_path: null,
        updated_at: null,
        points: 5,
        current_streak: 2,
        longest_streak: 2,
        last_rolled_date: null,
        joined_at: '2026-01-01T00:00:00Z',
      },
      {
        user_id: 'u-bob',
        display_name: 'Bob',
        avatar_path: null,
        updated_at: null,
        points: 3,
        current_streak: 1,
        longest_streak: 1,
        last_rolled_date: null,
        joined_at: '2026-01-15T00:00:00Z',
      },
    ];
    qc.setQueryData(['groupLeaderboard', validGroupId], initialRows);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboardRealtime } = require('../../../src/features/groups/useGroupLeaderboardRealtime');
    renderHook(() => useGroupLeaderboardRealtime(validGroupId), { wrapper });

    // Synthetic UPDATE event: Alice's points went from 5 → 6.
    const handler = getHandler()!;
    act(() =>
      handler({
        new: {
          group_id: validGroupId,
          user_id: 'u-alice',
          points: 6,
          current_streak: 3,
          longest_streak: 3,
        },
      }),
    );

    const patched = qc.getQueryData<typeof initialRows>(['groupLeaderboard', validGroupId]);
    expect(patched?.find((r) => r.user_id === 'u-alice')?.points).toBe(6);
    expect(patched?.find((r) => r.user_id === 'u-alice')?.current_streak).toBe(3);
    // Bob unchanged.
    expect(patched?.find((r) => r.user_id === 'u-bob')?.points).toBe(3);
  });

  it('cleans up channel on unmount via removeChannel', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../../src/lib/supabase');
    const { wrapper, removeChannel } = setupChannelMock(supabase);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGroupLeaderboardRealtime } = require('../../../src/features/groups/useGroupLeaderboardRealtime');

    const { unmount } = renderHook(() => useGroupLeaderboardRealtime(validGroupId), {
      wrapper,
    });
    unmount();

    expect(removeChannel).toHaveBeenCalled();
  });
});
