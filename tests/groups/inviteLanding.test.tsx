// Deep-link invite landing integration tests (02-06-PLAN Task 3).
// Exercises the three render branches: loading skeleton / not-found /
// unauth preview / authed ready + the PENDING_INVITE_KEY persistence contract.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// Hook mocks — each test can tweak return values.
const mockUseInvitePreview = jest.fn();
jest.mock('../../src/features/groups/useInvitePreview', () => ({
  useInvitePreview: (...args: unknown[]) => mockUseInvitePreview(...args),
}));

const mockMutateAsync = jest.fn();
const mockUseRedeemInvite = jest.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));
jest.mock('../../src/features/groups/useRedeemInvite', () => ({
  useRedeemInvite: () => mockUseRedeemInvite(),
}));

const mockUseSession = jest.fn();
jest.mock('../../src/features/auth/AuthProvider', () => ({
  useSession: () => mockUseSession(),
}));

// expo-router: assert on replace() + useLocalSearchParams returns a fixed code.
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockCodeParam: string = 'ABCDEF23';
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ code: mockCodeParam }),
  Stack: { Screen: () => null },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const InviteLandingScreen = require('../../app/invite/[code]').default;

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

describe('InviteLandingScreen', () => {
  beforeEach(() => {
    mockUseInvitePreview.mockReset();
    mockMutateAsync.mockReset();
    mockUseSession.mockReset();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockPush.mockClear();
    mockCodeParam = 'ABCDEF23';
    // Reset SecureStore in-memory mock.
    const SecureStore = require('expo-secure-store');
    (SecureStore.setItemAsync as jest.Mock).mockClear();
    (SecureStore.getItemAsync as jest.Mock).mockClear();
    (SecureStore.deleteItemAsync as jest.Mock).mockClear();
  });

  it('loading branch: sessionLoading renders skeleton, no title yet', () => {
    mockUseSession.mockReturnValue({ session: null, loading: true });
    mockUseInvitePreview.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
    });
    const { queryByText, getByLabelText } = render(
      withProviders(<InviteLandingScreen />),
    );
    // Neither the unauth title nor the authed title renders yet.
    expect(queryByText('Ready to join?')).toBeNull();
    expect(queryByText(/invited you/)).toBeNull();
    // Skeleton view is present.
    expect(getByLabelText('Loading invite')).toBeTruthy();
  });

  it('unauth branch: renders "{admin} invited you" + Sign in button; tap persists PENDING_INVITE_KEY then routes to /(auth)/login', async () => {
    mockUseSession.mockReturnValue({ session: null, loading: false });
    mockUseInvitePreview.mockReturnValue({
      data: {
        group_name: 'Morning runners',
        member_count: 3,
        admin_display_name: 'Alex',
      },
      isPending: false,
      isError: false,
      error: null,
    });
    const { getByText } = render(withProviders(<InviteLandingScreen />));
    expect(getByText('Alex invited you')).toBeTruthy();
    expect(getByText(/Morning runners/)).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Sign in to join'));
    });

    const SecureStore = require('expo-secure-store');
    // setItemAsync fires with the KEY + code BEFORE the route change.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'accountibuzz.pendingInviteCode',
      'ABCDEF23',
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
    // CRITICAL: no clear should ever happen on this screen.
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('authed branch: renders "Ready to join?" + Join group; tap calls redeem.mutateAsync', async () => {
    mockUseSession.mockReturnValue({
      session: { user: { id: 'u-1' } },
      loading: false,
    });
    mockUseInvitePreview.mockReturnValue({
      data: {
        group_name: 'Morning runners',
        member_count: 3,
        admin_display_name: 'Alex',
      },
      isPending: false,
      isError: false,
      error: null,
    });
    mockMutateAsync.mockResolvedValue('g-42');

    const { getByText } = render(withProviders(<InviteLandingScreen />));
    expect(getByText('Ready to join?')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Join group'));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith('ABCDEF23');
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/groups/g-42');
    });
  });

  it('not-found branch: preview error renders "Invite not found" + "Back to groups"', () => {
    mockUseSession.mockReturnValue({ session: null, loading: false });
    mockUseInvitePreview.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('invite_not_found'),
    });
    const { getByText } = render(withProviders(<InviteLandingScreen />));
    expect(getByText('Invite not found')).toBeTruthy();
    expect(getByText('Back to groups')).toBeTruthy();
    fireEvent.press(getByText('Back to groups'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
