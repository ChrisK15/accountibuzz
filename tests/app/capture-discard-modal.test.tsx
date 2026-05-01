/**
 * tests/app/capture-discard-modal.test.tsx
 *
 * Plan 03-07 Task 3 — capture screen discard-take Modal.
 *
 * Coverage:
 *   1. × tap WITHOUT a take dismisses immediately (no modal renders)
 *   2. The Modal copywriting contract is in source (Discard / Keep recording)
 *      — verified via static-import + render asserting modal copy is wired
 *
 * The full E2E (× tap WITH take → modal opens → Discard / Keep recording) is
 * deferred to Plan 03-08 manual UAT walkthrough because driving the screen
 * INTO review state requires a complex `takePictureAsync` mock chain on the
 * cameraRef, and CameraView is itself mocked as a string component (no
 * imperative method surface). Per plan 03-07 Task 3 PRACTICAL NOTE.
 */

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

jest.mock('../../src/features/groups/useGroup', () => ({
  useGroup: jest.fn(),
}));
jest.mock('../../src/features/submissions/useSubmitToday', () => ({
  useSubmitToday: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// expo-camera — granted-by-default for the discard-modal tests.
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [
    { granted: true, status: 'granted', canAskAgain: true, expires: 'never' },
    jest.fn(async () => ({
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    })),
  ],
  useMicrophonePermissions: () => [
    { granted: true, status: 'granted', canAskAgain: true, expires: 'never' },
    jest.fn(async () => ({
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    })),
  ],
}));

jest.mock('expo-linking', () => ({ openSettings: jest.fn() }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('expo-video', () => ({
  useVideoPlayer: (_uri: string, setup?: (p: unknown) => void) => {
    const player = { muted: false, loop: false, play: jest.fn(), pause: jest.fn() };
    if (setup) setup(player);
    return player;
  },
  VideoView: 'VideoView',
}));
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

describe('Capture discard-take modal', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockDismiss.mockClear();
    (useGroup as jest.Mock).mockReset();
  });

  it('× tap WITHOUT a take dismisses immediately (no Discard modal)', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: photoGroup,
      isPending: false,
    });
    const { getByLabelText, queryByText } = render(
      withProviders(<CaptureScreen />),
    );
    // CaptureTopBar's close button has accessibilityLabel="Close".
    fireEvent.press(getByLabelText('Close'));
    expect(mockDismiss).toHaveBeenCalled();
    // Modal must NOT render in the no-take path.
    expect(queryByText('Discard this take?')).toBeNull();
    expect(queryByText('Keep recording')).toBeNull();
  });

  it('does not render the Discard modal copy on first paint (capture state, no take)', () => {
    (useGroup as jest.Mock).mockReturnValue({
      data: photoGroup,
      isPending: false,
    });
    const { queryByText } = render(withProviders(<CaptureScreen />));
    // Sanity: in capture state with no mediaUri, the discard modal is hidden.
    expect(queryByText('Discard this take?')).toBeNull();
    expect(queryByText("You'll lose what you just recorded.")).toBeNull();
  });

  // Source-level contract check: verify the discard-modal copy and the
  // 'Keep recording' cancelLabel (NEVER 'Cancel' per the Modal dev-warning)
  // are wired in the screen file. The full E2E (× tap WITH take → modal opens
  // → tap Discard → router.dismiss; tap Keep recording → modal closes + stays
  // in review) is deferred to Plan 03-08 manual UAT — driving the screen into
  // review state in jest requires a complex takePictureAsync mock chain on
  // the cameraRef and the CameraView is mocked as a string component (no
  // imperative method surface).
  it('source contract: discard-modal copy + Keep recording cancelLabel are wired in the screen', () => {
    const screenPath = path.resolve(
      __dirname,
      '..',
      '..',
      'app',
      '(app)',
      'capture',
      '[groupId].tsx',
    );
    const src = readFileSync(screenPath, 'utf-8');
    expect(src).toMatch(/Discard this take\?/);
    expect(src).toMatch(/You'll lose what you just recorded\./);
    // primary action label
    expect(src).toMatch(/label: 'Discard'/);
    // destructive variant for Discard (UI-SPEC §Discard-take Modal)
    expect(src).toMatch(/variant: 'destructive'/);
    // cancelLabel MUST be 'Keep recording', NEVER 'Cancel'
    expect(src).toMatch(/cancelLabel="Keep recording"/);
    expect(src).not.toMatch(/cancelLabel="Cancel"/i);
  });
});
