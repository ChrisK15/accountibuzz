// Today screen — social-signal line wiring (Plan 04-06).
// Spec: 04-PLAN §"Wire social-signal hooks into GroupCardRow" + 04-UI-SPEC.md
// §"Today GroupCard social-signal line" (lines 283-296) + §"GroupCard
// social-signal line state matrix" (lines 859-868).
//
// Coverage:
//   1. Renders GroupCard with social prop when all data is loaded
//      (4/6 posted · 11 pts · 🔥3).
//   2. Renders be-the-first variant when posted === 0.
//   3. HIGH #10 GATE: hides social line when leaderboard is loading
//      (queryByText(/posted/) is null).
//   4. HIGH #10 GATE: hides social line when postedCount is null.
//   5. MEDIUM gate: useGroupTodayCardRealtime is called PER row with the SAME
//      userId from parent (proves the parent passed it down, NOT a per-row
//      useSession call).
//
// Mocking pattern: mirrors tests/groups/groupsListScreen.test.tsx — module
// mock useGroupsList + useSession + the 4 social hooks; assert via the
// GroupCard's rendered text.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// Module mocks (must come before screen import).
jest.mock('../../src/features/groups/useGroupsList', () => ({
  useGroupsList: jest.fn(),
}));
jest.mock('../../src/features/submissions/useTodaySubmission', () => ({
  useTodaySubmission: jest.fn(() => ({ data: null })),
}));
jest.mock('../../src/features/submissions/useUploadQueue', () => ({
  useUploadQueue: jest.fn(() => ({ data: new Map() })),
}));
jest.mock('../../src/features/submissions/useTodaySubmissionRealtime', () => ({
  useTodaySubmissionRealtime: jest.fn(),
}));
jest.mock('../../src/features/groups/useGroupSocialCounts', () => ({
  useGroupSocialCounts: jest.fn(),
}));
jest.mock('../../src/features/groups/useGroupLeaderboard', () => ({
  useGroupLeaderboard: jest.fn(),
}));
jest.mock('../../src/features/groups/useGroupTodayCardRealtime', () => ({
  useGroupTodayCardRealtime: jest.fn(),
}));
jest.mock('../../src/features/groups/useGroupMembers', () => ({
  useGroupMembers: jest.fn(() => ({ data: [] })),
}));

// expo-router router shim.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));

// Session: simple fake user (lifted to parent screen — MEDIUM fix).
jest.mock('../../src/features/auth/AuthProvider', () => ({
  useSession: () => ({
    user: { id: 'u-self', email: 't@t.test' },
    session: null,
    loading: false,
    recoveryPending: false,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useGroupsList } = require('../../src/features/groups/useGroupsList');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useGroupSocialCounts } = require('../../src/features/groups/useGroupSocialCounts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useGroupLeaderboard } = require('../../src/features/groups/useGroupLeaderboard');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useGroupTodayCardRealtime } = require('../../src/features/groups/useGroupTodayCardRealtime');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TodayScreen = require('../../app/(app)/index').default;

const theme: Theme = {
  colors: colors.light,
  spacing,
  radii,
  fonts,
  name: 'light',
};

function withProviders(node: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ThemeContext.Provider value={theme}>
        {node as ReactNode}
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}

const sixMemberGroup = {
  id: 'g1',
  name: 'Morning runners',
  goal: 'Post a photo before 9am.',
  submission_type: 'photo' as const,
  timezone: 'UTC',
  member_count: 6,
  admin_user_id: 'u-self',
};

describe('Today screen — social-signal line (Plan 04-06)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (useGroupsList as jest.Mock).mockReset();
    (useGroupSocialCounts as jest.Mock).mockReset();
    (useGroupLeaderboard as jest.Mock).mockReset();
    (useGroupTodayCardRealtime as jest.Mock).mockReset();
  });

  it('renders GroupCard with social prop when all data is loaded (4/6 posted · 11 pts · 🔥3)', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [sixMemberGroup],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    (useGroupSocialCounts as jest.Mock).mockReturnValue({ data: 4 });
    (useGroupLeaderboard as jest.Mock).mockReturnValue({
      data: [
        {
          user_id: 'u-self',
          display_name: 'Self',
          avatar_path: null,
          updated_at: null,
          points: 11,
          current_streak: 3,
          longest_streak: 3,
          last_rolled_date: null,
          joined_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const { getByText } = render(withProviders(<TodayScreen />));
    expect(getByText(/4\/6 posted/)).toBeTruthy();
    expect(getByText(/11 pts/)).toBeTruthy();
    expect(getByText(/🔥3/)).toBeTruthy();
  });

  it('renders be-the-first variant when posted === 0', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [sixMemberGroup],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    (useGroupSocialCounts as jest.Mock).mockReturnValue({ data: 0 });
    (useGroupLeaderboard as jest.Mock).mockReturnValue({
      data: [
        {
          user_id: 'u-self',
          display_name: 'Self',
          avatar_path: null,
          updated_at: null,
          points: 0,
          current_streak: 0,
          longest_streak: 0,
          last_rolled_date: null,
          joined_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const { getByText } = render(withProviders(<TodayScreen />));
    expect(getByText(/0\/6 posted/)).toBeTruthy();
    expect(getByText(/be the first/)).toBeTruthy();
  });

  it('HIGH #10 GATE: hides social line when leaderboard is loading (data undefined)', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [sixMemberGroup],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    (useGroupSocialCounts as jest.Mock).mockReturnValue({ data: 4 });
    // leaderboard.data is undefined — STRICT gate must hide the line.
    (useGroupLeaderboard as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
    });

    const { queryByText } = render(withProviders(<TodayScreen />));
    expect(queryByText(/posted/)).toBeNull();
  });

  it('HIGH #10 GATE: hides social line when postedCount is null', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [sixMemberGroup],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    // postedCount is null (not the same as 0) — STRICT gate must hide the line.
    (useGroupSocialCounts as jest.Mock).mockReturnValue({ data: null });
    (useGroupLeaderboard as jest.Mock).mockReturnValue({
      data: [
        {
          user_id: 'u-self',
          display_name: 'Self',
          avatar_path: null,
          updated_at: null,
          points: 0,
          current_streak: 0,
          longest_streak: 0,
          last_rolled_date: null,
          joined_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const { queryByText } = render(withProviders(<TodayScreen />));
    expect(queryByText(/posted/)).toBeNull();
  });

  it('MEDIUM gate: useGroupTodayCardRealtime is called per row with userId lifted from parent', () => {
    const secondGroup = {
      ...sixMemberGroup,
      id: 'g2',
      name: 'Solo studio',
      submission_type: 'video' as const,
      member_count: 3,
    };
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [sixMemberGroup, secondGroup],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    (useGroupSocialCounts as jest.Mock).mockReturnValue({ data: 0 });
    (useGroupLeaderboard as jest.Mock).mockReturnValue({ data: [] });

    render(withProviders(<TodayScreen />));

    // Hook called twice (one per row), BOTH with the SAME userId from parent.
    expect(useGroupTodayCardRealtime).toHaveBeenCalledTimes(2);
    const callArgs = (useGroupTodayCardRealtime as jest.Mock).mock.calls;
    expect(callArgs[0]).toEqual(['g1', 'u-self']);
    expect(callArgs[1]).toEqual(['g2', 'u-self']);
  });
});
