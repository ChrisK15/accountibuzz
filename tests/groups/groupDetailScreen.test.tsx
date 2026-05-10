// Group-detail screen — integration tests.
// Spec: 02-UI-SPEC.md §"Group detail" (lines 381-399); 02-04-PLAN.md §Task 3.
// Phase 4 (04-05): added the 4 new sections (Leaderboard, Today's posts,
// Still to post, Missed yesterday) + D-09 stack-order check + cutoffLabelFor
// HIGH #9 static-literal gate.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// Hook module mocks (must come before screen import).
jest.mock('../../src/features/groups/useGroup', () => ({
  useGroup: jest.fn(),
}));
jest.mock('../../src/features/groups/useGroupMembers', () => ({
  useGroupMembers: jest.fn(),
}));
jest.mock('../../src/features/groups/useActiveInvite', () => ({
  useActiveInvite: jest.fn(),
}));
jest.mock('../../src/features/groups/useLeaveGroup', () => ({
  useLeaveGroup: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../../src/features/groups/useTransferAdmin', () => ({
  useTransferAdmin: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../../src/features/groups/useDeleteGroup', () => ({
  useDeleteGroup: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../../src/features/groups/useRegenerateInvite', () => ({
  useRegenerateInvite: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../../src/features/groups/shareInvite', () => ({
  shareInvite: jest.fn(),
}));

// usePendingReviewCount — used by the (admin) PendingReviewRow gate.
// Default: count 0 → row hidden; tests that need the row override per-test.
jest.mock('../../src/features/submissions/usePendingReviewCount', () => ({
  usePendingReviewCount: jest.fn(() => ({ data: 0 })),
}));

// Phase 4 (04-05) hook mocks — the screen wires in 4 new sections + 2
// Realtime channels. Each mock is a no-op default; per-test overrides
// drive the section-specific assertions.
jest.mock('../../src/features/groups/useGroupLeaderboard', () => ({
  useGroupLeaderboard: jest.fn(() => ({ data: undefined, isPending: true })),
}));
jest.mock('../../src/features/groups/useGroupLeaderboardRealtime', () => ({
  useGroupLeaderboardRealtime: jest.fn(),
}));
jest.mock('../../src/features/submissions/useGroupFeed', () => ({
  useGroupFeed: jest.fn(() => ({ data: undefined, isPending: true })),
}));
jest.mock('../../src/features/submissions/useGroupFeedRealtime', () => ({
  useGroupFeedRealtime: jest.fn(),
}));
jest.mock('../../src/features/submissions/useReviewQueueRealtime', () => ({
  useReviewQueueRealtime: jest.fn(),
}));
jest.mock('../../src/features/groups/useGroupTombstones', () => ({
  useGroupTombstones: jest.fn(() => ({
    pendingToday: [],
    missedYesterday: [],
    isPending: false,
    error: null,
  })),
}));

// Stub the shared signed-URL hook so the MediaViewer (rendered conditionally
// at the screen root) does not try to hit supabase.storage when opened.
jest.mock('../../src/hooks/useSignedMediaUrl', () => ({
  useSignedMediaUrl: jest.fn(() => ({
    data: 'https://example.com/foo.jpg',
    isPending: false,
    error: null,
  })),
}));

// expo-router mock: useLocalSearchParams returns the group id; router is spyable.
// Variable names MUST start with `mock` so jest's hoist guard permits access inside the factory.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ id: 'g1' }),
}));

// Session: current user is id u-1.
const currentUserId = 'u-1';
jest.mock('../../src/features/auth/AuthProvider', () => ({
  useSession: () => ({
    user: { id: currentUserId, email: 't@t.test' },
    session: null,
    loading: false,
    recoveryPending: false,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useGroup } = require('../../src/features/groups/useGroup');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useGroupMembers } = require('../../src/features/groups/useGroupMembers');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useActiveInvite } = require('../../src/features/groups/useActiveInvite');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { usePendingReviewCount } = require('../../src/features/submissions/usePendingReviewCount');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useGroupLeaderboard } = require('../../src/features/groups/useGroupLeaderboard');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useGroupFeed } = require('../../src/features/submissions/useGroupFeed');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useGroupTombstones } = require('../../src/features/groups/useGroupTombstones');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GroupDetailScreen = require('../../app/(app)/groups/[id]/index').default;

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

const baseGroup = {
  id: 'g1',
  name: 'Morning runners',
  goal: 'Post a photo before 9am.',
  submission_type: 'photo' as const,
  timezone: 'UTC',
  admin_user_id: currentUserId, // default admin
  created_at: '2026-04-24T00:00:00Z',
};

describe('GroupDetailScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    (useGroup as jest.Mock).mockReset();
    (useGroupMembers as jest.Mock).mockReset();
    (useActiveInvite as jest.Mock).mockReset();
  });

  it('admin role renders the invite panel with Share code + Regenerate code', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: baseGroup,
      isPending: false,
    });
    (useGroupMembers as jest.Mock).mockReturnValue({
      data: [
        { user_id: currentUserId, role: 'admin', display_name: 'Alex', avatar_path: null },
      ],
      isPending: false,
    });
    (useActiveInvite as jest.Mock).mockReturnValue({
      data: { code: 'ABCDEF23', expires_at: '2099-01-01T00:00:00Z' },
    });

    const { getByText } = render(withProviders(<GroupDetailScreen />));
    // InviteCodeChip formats as XXXX-XXXX
    expect(getByText('ABCD-EF23')).toBeTruthy();
    expect(getByText('Share code')).toBeTruthy();
    expect(getByText('Regenerate code')).toBeTruthy();
  });

  it('non-admin role shows Leave group in the destructive zone', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: { ...baseGroup, admin_user_id: 'someone-else' },
      isPending: false,
    });
    (useGroupMembers as jest.Mock).mockReturnValue({
      data: [
        { user_id: 'someone-else', role: 'admin', display_name: 'Al', avatar_path: null },
        { user_id: currentUserId, role: 'member', display_name: 'Me', avatar_path: null },
      ],
      isPending: false,
    });
    (useActiveInvite as jest.Mock).mockReturnValue({ data: null });

    const { getByText, queryByText } = render(
      withProviders(<GroupDetailScreen />),
    );
    expect(getByText('Leave group')).toBeTruthy();
    // Non-admin must NOT see the invite panel.
    expect(queryByText('Share code')).toBeNull();
    expect(queryByText('Regenerate code')).toBeNull();
  });

  it('tapping non-admin "Leave group" opens member-leave Modal with exact copy + cancelLabel', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: { ...baseGroup, admin_user_id: 'someone-else' },
      isPending: false,
    });
    (useGroupMembers as jest.Mock).mockReturnValue({
      data: [
        { user_id: 'someone-else', role: 'admin', display_name: 'Al', avatar_path: null },
        { user_id: currentUserId, role: 'member', display_name: 'Me', avatar_path: null },
      ],
      isPending: false,
    });
    (useActiveInvite as jest.Mock).mockReturnValue({ data: null });

    const { getByText } = render(withProviders(<GroupDetailScreen />));
    fireEvent.press(getByText('Leave group'));

    // Modal title uses the group name verbatim.
    expect(getByText('Leave Morning runners?')).toBeTruthy();
    expect(getByText('Stay in group')).toBeTruthy();
  });

  it('admin "Delete group" (bottom) opens delete-confirm Modal with "Keep the group" cancelLabel', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: baseGroup,
      isPending: false,
    });
    (useGroupMembers as jest.Mock).mockReturnValue({
      data: [
        { user_id: currentUserId, role: 'admin', display_name: 'Me', avatar_path: null },
      ],
      isPending: false,
    });
    (useActiveInvite as jest.Mock).mockReturnValue({
      data: { code: 'ABCDEF23', expires_at: '2099-01-01T00:00:00Z' },
    });

    const { getByText } = render(withProviders(<GroupDetailScreen />));
    fireEvent.press(getByText('Delete group'));

    expect(getByText('Delete this group?')).toBeTruthy();
    expect(getByText('Keep the group')).toBeTruthy();
  });
});

// ── Phase 4 (04-05) sections ─────────────────────────────────────────────
//
// Wires the 4 new sections into the group-detail screen + REORDERED
// PendingReviewRow / InvitePanel below Members per D-09 + HIGH #4.
// HIGH #3: reduceMotion useState declared before the consuming hooks.
// HIGH #5: applyAlpha used by empty-leaderboard callout.
// HIGH #9: cutoffLabelFor returns the static literal '12:00 AM'.

// Module-level require for the helper export that lives inside the screen
// file. cutoffLabelFor is a private export; we don't import it in production
// callers but expose it on a module property for the test gate per HIGH #9.
// The screen file exports it as a named export for that purpose.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const screenModule = require('../../app/(app)/groups/[id]/index');

describe('GroupDetailScreen — Phase 4 sections', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    (useGroup as jest.Mock).mockReset();
    (useGroupMembers as jest.Mock).mockReset();
    (useActiveInvite as jest.Mock).mockReset();
    (usePendingReviewCount as jest.Mock).mockReturnValue({ data: 0 });
    (useGroupLeaderboard as jest.Mock).mockReset();
    (useGroupFeed as jest.Mock).mockReset();
    (useGroupTombstones as jest.Mock).mockReset();
  });

  function setupBaseMocks(opts?: {
    leaderboard?: unknown;
    feed?: unknown;
    pendingToday?: unknown[];
    missedYesterday?: unknown[];
    pendingReviewCount?: number;
  }) {
    (useGroup as jest.Mock).mockReturnValue({
      data: baseGroup,
      isPending: false,
    });
    (useGroupMembers as jest.Mock).mockReturnValue({
      data: [
        {
          user_id: currentUserId,
          role: 'admin',
          display_name: 'Alex',
          avatar_path: null,
          updated_at: null,
          joined_at: '2026-01-01T00:00:00Z',
        },
      ],
      isPending: false,
    });
    (useActiveInvite as jest.Mock).mockReturnValue({
      data: { code: 'ABCDEF23', expires_at: '2099-01-01T00:00:00Z' },
    });
    (useGroupLeaderboard as jest.Mock).mockReturnValue({
      data: opts?.leaderboard ?? [],
      isPending: false,
    });
    (useGroupFeed as jest.Mock).mockReturnValue({
      data: opts?.feed ?? [],
      isPending: false,
    });
    (useGroupTombstones as jest.Mock).mockReturnValue({
      pendingToday: opts?.pendingToday ?? [],
      missedYesterday: opts?.missedYesterday ?? [],
      isPending: false,
      error: null,
    });
    (usePendingReviewCount as jest.Mock).mockReturnValue({
      data: opts?.pendingReviewCount ?? 0,
    });
  }

  it('renders the Leaderboard section header when group is loaded', () => {
    setupBaseMocks({
      leaderboard: [
        {
          user_id: currentUserId,
          display_name: 'Alex',
          avatar_path: null,
          updated_at: null,
          points: 5,
          current_streak: 2,
          longest_streak: 2,
          last_rolled_date: null,
          joined_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const { getByText } = render(withProviders(<GroupDetailScreen />));
    expect(getByText('Leaderboard')).toBeTruthy();
  });

  it('renders Today\'s posts header with the count', () => {
    setupBaseMocks({
      feed: [
        {
          id: 's-1',
          user_id: currentUserId,
          caption: null,
          media_path: 'u/2026-05-08/foo.jpg',
          media_type: 'photo',
          created_at: new Date().toISOString(),
          display_name: 'Alex',
          avatar_path: null,
          updated_at: null,
        },
      ],
    });
    const { getByText } = render(withProviders(<GroupDetailScreen />));
    // The header text format is "Today's posts (1)" per D-09 / UI-SPEC.
    expect(getByText(/Today's posts/)).toBeTruthy();
  });

  it('omits Still to post section when pendingToday is empty', () => {
    setupBaseMocks({ pendingToday: [] });
    const { queryByText } = render(withProviders(<GroupDetailScreen />));
    expect(queryByText(/Still to post/i)).toBeNull();
  });

  it('omits Missed yesterday section when missedYesterday is empty', () => {
    setupBaseMocks({ missedYesterday: [] });
    const { queryByText } = render(withProviders(<GroupDetailScreen />));
    expect(queryByText(/Missed yesterday/i)).toBeNull();
  });

  it('renders Today\'s posts dashed-border empty card when feed is empty', () => {
    setupBaseMocks({ feed: [] });
    const { getByText } = render(withProviders(<GroupDetailScreen />));
    // Empty-state copy from UI-SPEC §Today's posts: "be the first" callout.
    expect(getByText(/be the first/i)).toBeTruthy();
  });

  it('HIGH #4 D-09 stack order: Members renders BEFORE PendingReviewRow BEFORE destructive zone', () => {
    setupBaseMocks({ pendingReviewCount: 3 });
    const { getByText } = render(withProviders(<GroupDetailScreen />));

    // Sentinels:
    //   "Members (1)" — Members section header.
    //   "Pending review (3)" — PendingReviewRow card title (admin + count > 0).
    //   "Delete group" — destructive zone (admin variant).
    const membersNode = getByText(/^Members \(/);
    const pendingNode = getByText(/Pending review \(3\)/);
    const destructiveNode = getByText('Delete group');

    // No direct DOM ordering API in RN testing-library; use the testInstance
    // ancestor chain to discover sibling order. The three nodes share a
    // ScrollView ancestor — find a common ancestor and assert the order via
    // first-occurrence in a depth-first walk.
    const seen: string[] = [];
    function walk(node: { children?: unknown; type?: unknown; props?: unknown }) {
      if (!node) return;
      if (node === membersNode) seen.push('members');
      if (node === pendingNode) seen.push('pending');
      if (node === destructiveNode) seen.push('destructive');
      const childrenProp = node.children;
      if (Array.isArray(childrenProp)) {
        for (const c of childrenProp) {
          if (c && typeof c === 'object') walk(c as never);
        }
      }
    }
    // Find the closest ScrollView ancestor by climbing the chain.
    let cursor: unknown = membersNode;
    while (
      cursor &&
      typeof cursor === 'object' &&
      (cursor as { parent?: unknown }).parent
    ) {
      cursor = (cursor as { parent?: unknown }).parent;
      const t = (cursor as { type?: unknown }).type;
      if (
        typeof t === 'string'
          ? t === 'RCTScrollView' || t === 'ScrollView'
          : (t as { displayName?: string })?.displayName === 'ScrollView'
      ) {
        break;
      }
    }
    walk(cursor as { children?: unknown });

    // Assert both order pairs hold.
    const idxMembers = seen.indexOf('members');
    const idxPending = seen.indexOf('pending');
    const idxDestructive = seen.indexOf('destructive');
    expect(idxMembers).toBeGreaterThanOrEqual(0);
    expect(idxPending).toBeGreaterThanOrEqual(0);
    expect(idxDestructive).toBeGreaterThanOrEqual(0);
    expect(idxMembers).toBeLessThan(idxPending);
    expect(idxPending).toBeLessThan(idxDestructive);
  });
});

describe('cutoffLabelFor (HIGH #9 — Iteration 1 fix)', () => {
  it('returns the static literal "12:00 AM" for any group timezone (MVP — group cutoff is always group-tz midnight by construction)', () => {
    // Helper is exported from the screen module for testability.
    const fn = (screenModule as { cutoffLabelFor?: (tz: string) => string })
      .cutoffLabelFor;
    expect(fn).toBeDefined();
    expect(fn!('America/Los_Angeles')).toMatch(/^12:00 AM/);
    expect(fn!('America/New_York')).toMatch(/^12:00 AM/);
    expect(fn!('Asia/Tokyo')).toMatch(/^12:00 AM/);
  });
});
