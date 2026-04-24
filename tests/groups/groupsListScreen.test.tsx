// Groups-list signed-in home — integration tests.
// Spec: 02-UI-SPEC.md §"Groups list" (lines 350-362); 02-04-PLAN.md §Task 3.
//
// We mock the hook module + expo-router + useSession so the tests exercise
// the screen's branching (empty vs populated) and navigation intent directly.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// Hook module mock (must come before screen import).
jest.mock('../../src/features/groups/useGroupsList', () => ({
  useGroupsList: jest.fn(),
}));
jest.mock('../../src/features/profile/useProfile', () => ({
  useProfile: jest.fn(() => ({ data: null })),
}));

// expo-router: useRouter returns jest.fns we can assert on.
// Names MUST start with `mock` so jest's hoist guard allows them inside the factory.
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
}));

// Session: simple fake user.
jest.mock('../../src/features/auth/AuthProvider', () => ({
  useSession: () => ({
    user: { id: 'u-1', email: 't@t.test' },
    session: null,
    loading: false,
    recoveryPending: false,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useGroupsList } = require('../../src/features/groups/useGroupsList');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GroupsListScreen = require('../../app/(app)/index').default;

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

describe('GroupsListScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    (useGroupsList as jest.Mock).mockReset();
  });

  it('empty state renders the two-CTA layout with exact UI-SPEC copy', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(withProviders(<GroupsListScreen />));
    expect(getByText('No groups yet')).toBeTruthy();
    expect(
      getByText('Start one with friends or hop into theirs.'),
    ).toBeTruthy();
    expect(getByText('Create a group')).toBeTruthy();
    expect(getByText('Join with a code')).toBeTruthy();
  });

  it('tapping "Create a group" routes to /groups/new', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(withProviders(<GroupsListScreen />));
    fireEvent.press(getByText('Create a group'));
    expect(mockPush).toHaveBeenCalledWith('/groups/new');
  });

  it('populated state renders each group row with name + metadata line', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'g1',
          name: 'Morning runners',
          goal: 'Post a photo before 9am.',
          submission_type: 'photo',
          timezone: 'UTC',
          member_count: 5,
          admin_user_id: 'u-1',
        },
        {
          id: 'g2',
          name: 'Solo studio',
          goal: 'Film a quick check-in.',
          submission_type: 'video',
          timezone: 'UTC',
          member_count: 1,
          admin_user_id: 'u-2',
        },
      ],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(withProviders(<GroupsListScreen />));
    expect(getByText('Morning runners')).toBeTruthy();
    expect(getByText('Solo studio')).toBeTruthy();
    // Metadata pluralisation: 5 members (plural), 1 member (singular).
    expect(getByText(/5 members/)).toBeTruthy();
    expect(getByText(/1 member\b/)).toBeTruthy();
  });

  it('tapping a row routes to /groups/<id>', () => {
    (useGroupsList as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'g1',
          name: 'Morning runners',
          goal: 'Post a photo before 9am.',
          submission_type: 'photo',
          timezone: 'UTC',
          member_count: 5,
          admin_user_id: 'u-1',
        },
      ],
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(withProviders(<GroupsListScreen />));
    fireEvent.press(getByText('Morning runners'));
    expect(mockPush).toHaveBeenCalledWith('/groups/g1');
  });
});
