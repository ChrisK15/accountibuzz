/**
 * tests/app/capture-permission-denied.test.tsx
 *
 * Plan 03-07 Task 3 — capture screen permission-denied paths.
 *
 * Coverage (4 cases):
 *   1. Camera permission status='denied' → renders camera-permission-denied screen
 *      with the exact UI-SPEC copy "We need camera access" + Open Settings button
 *   2. Open Settings button calls Linking.openSettings()
 *   3. Video group + microphone permission status='denied' → renders
 *      microphone-permission-denied screen ("We need mic access too")
 *   4. Photo group with mic returning 'denied' STILL skips the mic gate
 *      (mic is only requested for video groups per UI-SPEC line 792)
 *
 * Pattern source: tests/groups/groupDetailScreen.test.tsx (hook-mock pattern,
 * expo-router mock, withProviders wrapper).
 */

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// ── Mock the hook + screen-level deps BEFORE importing the screen ──────
jest.mock('../../src/features/groups/useGroup', () => ({
  useGroup: jest.fn(),
}));
jest.mock('../../src/features/submissions/useSubmitToday', () => ({
  useSubmitToday: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// expo-camera permissions are per-test overridable. Default to denied for
// camera + mic so the screen never falls through to the viewfinder.
const mockCamPerm = {
  granted: false,
  status: 'denied' as const,
  canAskAgain: false,
  expires: 'never',
};
const mockMicPerm = {
  granted: false,
  status: 'denied' as const,
  canAskAgain: false,
  expires: 'never',
};
let mockCamPermState: typeof mockCamPerm | { granted: true; status: 'granted'; canAskAgain: true; expires: 'never' } = mockCamPerm;
let mockMicPermState: typeof mockMicPerm | { granted: true; status: 'granted'; canAskAgain: true; expires: 'never' } = mockMicPerm;
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [mockCamPermState, jest.fn(async () => mockCamPermState)],
  useMicrophonePermissions: () => [
    mockMicPermState,
    jest.fn(async () => mockMicPermState),
  ],
}));

// expo-linking — track openSettings calls.
const mockOpenSettings = jest.fn();
jest.mock('expo-linking', () => ({
  openSettings: () => mockOpenSettings(),
}));

// expo-haptics — silent in tests.
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// expo-video — useVideoPlayer returns an idle player.
jest.mock('expo-video', () => ({
  useVideoPlayer: (_uri: string, setup?: (p: unknown) => void) => {
    const player = {
      muted: false,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
    };
    if (setup) setup(player);
    return player;
  },
  VideoView: 'VideoView',
}));

// expo-image — Image is just a passthrough in tests.
jest.mock('expo-image', () => ({ Image: 'Image' }));

// react-native-safe-area-context — useSafeAreaInsets returns zeros for tests.
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RN = jest.requireActual('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: RN.View,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// expo-router — useLocalSearchParams returns the groupId; router is spyable.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDismiss = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    dismiss: mockDismiss,
  }),
  useLocalSearchParams: () => ({ groupId: 'g-1' }),
  Stack: { Screen: () => null },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useGroup } = require('../../src/features/groups/useGroup');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CaptureScreen = require('../../app/(app)/capture/[groupId]').default;

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

const photoGroup = {
  id: 'g-1',
  name: 'Morning runners',
  goal: 'Post a photo before 9am.',
  submission_type: 'photo' as const,
  timezone: 'UTC',
  admin_user_id: 'u-1',
  created_at: '2026-04-24T00:00:00Z',
};
const videoGroup = { ...photoGroup, submission_type: 'video' as const };

describe('Capture screen permission gates', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockDismiss.mockClear();
    mockOpenSettings.mockClear();
    (useGroup as jest.Mock).mockReset();
    // Reset to denied default per test (each test overrides as needed).
    mockCamPermState = mockCamPerm;
    mockMicPermState = mockMicPerm;
  });

  it('renders camera-denied screen with exact UI-SPEC copy when permission status = denied', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: photoGroup,
      isPending: false,
    });
    mockCamPermState = mockCamPerm; // denied
    const { getByText } = render(withProviders(<CaptureScreen />));
    expect(getByText('We need camera access')).toBeTruthy();
    expect(
      getByText('Tap below to grant access in Settings, then come back.'),
    ).toBeTruthy();
    expect(getByText('Open Settings')).toBeTruthy();
    expect(getByText('Not now')).toBeTruthy();
  });

  it('Open Settings button calls Linking.openSettings()', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: photoGroup,
      isPending: false,
    });
    mockCamPermState = mockCamPerm; // denied
    const { getByText } = render(withProviders(<CaptureScreen />));
    fireEvent.press(getByText('Open Settings'));
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it('Not now button calls router.dismiss()', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: photoGroup,
      isPending: false,
    });
    mockCamPermState = mockCamPerm; // denied
    const { getByText } = render(withProviders(<CaptureScreen />));
    fireEvent.press(getByText('Not now'));
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('renders mic-denied screen when video group + mic permission denied (camera granted)', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: videoGroup,
      isPending: false,
    });
    mockCamPermState = {
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    };
    mockMicPermState = mockMicPerm; // denied
    const { getByText } = render(withProviders(<CaptureScreen />));
    expect(getByText('We need mic access too')).toBeTruthy();
    expect(
      getByText(
        'Videos record audio — flip on mic access in Settings to keep going.',
      ),
    ).toBeTruthy();
    expect(getByText('Open Settings')).toBeTruthy();
  });

  it('photo group does NOT render mic-denied screen even when mic mock returns denied', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: photoGroup,
      isPending: false,
    });
    mockCamPermState = {
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    };
    mockMicPermState = mockMicPerm; // denied — should be ignored for photo group
    const { queryByText } = render(withProviders(<CaptureScreen />));
    expect(queryByText('We need mic access too')).toBeNull();
    expect(queryByText('We need camera access')).toBeNull();
  });
});
