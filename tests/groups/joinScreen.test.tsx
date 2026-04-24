// Join-with-code screen integration tests (02-06-PLAN Task 3).
// Exercises the code-entry screen's normalization + typed-error mapping.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// Mock the hook module BEFORE the screen imports. Provide a jest.fn we can
// point at different resolved/rejected values per test.
const mockMutateAsync = jest.fn();
jest.mock('../../src/features/groups/useRedeemInvite', () => ({
  useRedeemInvite: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// expo-router: we assert on replace() and back() calls.
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const JoinScreen = require('../../app/(app)/groups/join').default;

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

describe('JoinScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockPush.mockClear();
  });

  it('renders the "Got a code?" title and the helper caption', () => {
    const { getAllByText, getByText } = render(withProviders(<JoinScreen />));
    // Title appears in both the nav bar and ScreenHeader.
    expect(getAllByText('Got a code?').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Enter it below to join your friends.')).toBeTruthy();
    expect(getByText('8 letters and numbers. Dashes optional.')).toBeTruthy();
  });

  it('normalizes lower-case + dashed input into dashed uppercase display (ABCD-EF23)', () => {
    const { getByLabelText } = render(withProviders(<JoinScreen />));
    const input = getByLabelText('Invite code');
    fireEvent.changeText(input, 'abcd-ef23');
    // The input renders the raw+dashed form derived from the normalized code.
    expect(input.props.value).toBe('ABCD-EF23');
  });

  it('submit with a valid 8-char code passes the RAW un-dashed code to mutateAsync', async () => {
    mockMutateAsync.mockResolvedValue('g-777');
    const { getByLabelText, getByText } = render(
      withProviders(<JoinScreen />),
    );
    const input = getByLabelText('Invite code');
    fireEvent.changeText(input, 'abcd-ef23');
    await waitFor(() => {
      // wait for form validity to flip
      expect(input.props.value).toBe('ABCD-EF23');
    });
    await act(async () => {
      fireEvent.press(getByText('Join group'));
    });
    expect(mockMutateAsync).toHaveBeenCalledWith('ABCDEF23');
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/groups/g-777');
    });
  });

  it('renders the group_full UI-SPEC copy when mutation throws Error("group_full")', async () => {
    mockMutateAsync.mockRejectedValue(new Error('group_full'));
    const { getByLabelText, getByText, findByText } = render(
      withProviders(<JoinScreen />),
    );
    const input = getByLabelText('Invite code');
    fireEvent.changeText(input, 'ABCDEF23');
    await act(async () => {
      fireEvent.press(getByText('Join group'));
    });
    expect(
      await findByText(
        "This group's already at 10 members. Ask the admin to make room or start your own.",
      ),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
