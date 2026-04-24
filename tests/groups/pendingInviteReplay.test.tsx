// Pending-invite replay hook integration test (02-06-PLAN Task 3).
//
// Contract (T-02-INV-REPLAY):
//   • When PENDING_INVITE_KEY has a stored code AND session becomes non-null,
//     the hook calls router.replace({ pathname: '/invite/[code]', params: { code } }).
//   • When no pending code is stored, the hook is a no-op on routing.
//   • The hook NEVER calls SecureStore.deleteItemAsync — clearing is owned by
//     useRedeemInvite.onSuccess so failed redeems can retry.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { render, waitFor } from '@testing-library/react-native';

// Session mock — each test sets the shape it wants.
const mockUseSession = jest.fn();
jest.mock('../../src/features/auth/AuthProvider', () => ({
  useSession: () => mockUseSession(),
}));

// Router mock — assert on replace() shape.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  usePendingInviteReplay,
  PENDING_INVITE_KEY,
} = require('../../src/features/groups/usePendingInviteReplay');

function Probe() {
  usePendingInviteReplay();
  return null;
}

describe('usePendingInviteReplay', () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockReplace.mockClear();
    const SecureStore = require('expo-secure-store');
    (SecureStore.setItemAsync as jest.Mock).mockClear();
    (SecureStore.getItemAsync as jest.Mock).mockClear();
    (SecureStore.deleteItemAsync as jest.Mock).mockClear();
  });

  it('routes to /invite/[code] when a code is stored AND session is non-null', async () => {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(PENDING_INVITE_KEY, 'ABCDEF23');
    (SecureStore.setItemAsync as jest.Mock).mockClear(); // don't count the seed
    mockUseSession.mockReturnValue({
      session: { user: { id: 'u-1' } },
      loading: false,
    });

    render(<Probe />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/invite/[code]',
        params: { code: 'ABCDEF23' },
      });
    });
  });

  it('does not route when no pending code is stored', async () => {
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
    (SecureStore.deleteItemAsync as jest.Mock).mockClear();
    mockUseSession.mockReturnValue({
      session: { user: { id: 'u-1' } },
      loading: false,
    });

    render(<Probe />);

    // Give any pending microtasks a chance to resolve, then assert.
    await new Promise((r) => setTimeout(r, 10));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('never calls SecureStore.deleteItemAsync on read (T-02-INV-REPLAY invariant)', async () => {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(PENDING_INVITE_KEY, 'ABCDEF23');
    (SecureStore.deleteItemAsync as jest.Mock).mockClear();
    mockUseSession.mockReturnValue({
      session: { user: { id: 'u-1' } },
      loading: false,
    });

    render(<Probe />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    // Critically: the hook must NOT clear the key.
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
