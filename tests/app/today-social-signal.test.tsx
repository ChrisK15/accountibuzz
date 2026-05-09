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

// Tree-walk helper — InlineSocialSignal uses accessibilityElementsHidden +
// importantForAccessibility="no-hide-descendants" so the parent GroupCard
// composite a11y label can carry the social fragment without VoiceOver
// double-reading. testing-library's getByText / queryByText filter such
// subtrees out by default, so we walk the rendered JSON tree directly to
// find substrings. Same pattern used by tests/components/GroupCard.test.tsx
// (Plan 04-04).
function collectAllText(root: unknown): string[] {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (!node) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    const obj = node as { children?: unknown };
    if (Array.isArray(obj.children)) {
      for (const c of obj.children) walk(c);
    }
  }
  walk(root);
  return out;
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

    const { toJSON } = render(withProviders(<TodayScreen />));
    const all = collectAllText(toJSON());
    expect(all.some((s) => s.includes('4/6 posted'))).toBe(true);
    expect(all.some((s) => s.includes('11 pts'))).toBe(true);
    expect(all.some((s) => s.includes('🔥3'))).toBe(true);
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

    const { toJSON } = render(withProviders(<TodayScreen />));
    const all = collectAllText(toJSON());
    expect(all.some((s) => s.includes('0/6 posted'))).toBe(true);
    expect(all.some((s) => s.includes('be the first'))).toBe(true);
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

    const { toJSON } = render(withProviders(<TodayScreen />));
    const all = collectAllText(toJSON());
    // Strict-gate: NO "posted" fragment anywhere in the rendered tree.
    expect(all.some((s) => /posted/.test(s))).toBe(false);
    expect(all.some((s) => /be the first/.test(s))).toBe(false);
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

    const { toJSON } = render(withProviders(<TodayScreen />));
    const all = collectAllText(toJSON());
    // Strict-gate: postedCount === null means social is undefined → no line.
    expect(all.some((s) => /posted/.test(s))).toBe(false);
    expect(all.some((s) => /be the first/.test(s))).toBe(false);
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
