// Group-detail screen — integration tests.
// Spec: 02-UI-SPEC.md §"Group detail" (lines 381-399); 02-04-PLAN.md §Task 3.

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
