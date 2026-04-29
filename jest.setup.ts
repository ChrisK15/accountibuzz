// jest.setup.ts — registers test-time mocks for native modules.
import '@testing-library/jest-native/extend-expect';

// In-memory SecureStore mock
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

// In-memory AsyncStorage mock — v3 of @react-native-async-storage/async-storage
// no longer ships the legacy jest mock at /jest/async-storage-mock, so we
// implement a minimal in-memory shim here.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  const api = {
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
    multiGet: jest.fn(async (keys: string[]) =>
      keys.map((k) => [k, store.has(k) ? store.get(k)! : null]),
    ),
    multiSet: jest.fn(async (pairs: [string, string][]) => {
      for (const [k, v] of pairs) store.set(k, v);
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
  };
  return { __esModule: true, default: api, ...api };
});

// expo-image-picker — minimal mock (used by plan 05 tests)
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// expo-image-manipulator — minimal mock (plan 05 avatar upload pipeline)
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri: string) => ({ uri: `${uri}.resized` })),
  SaveFormat: { JPEG: 'jpeg' },
}));

// expo-file-system — minimal mock (plan 05 avatar upload pipeline + Phase 3
// upload pipeline). SDK 55 deprecated the top-level API; production code uses
// `expo-file-system/legacy` for base64 reads and the new `File` class from the
// top-level for `arrayBuffer()` (Phase 3 upload). Both paths mocked.
// PER 03-01-PLAN Task 3: top-level mock now exposes the modern `File` class
// (returns ArrayBuffer) so capture-upload tests can drive the new path.
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(async () => 'base64data'),
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  })),
}));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(async () => 'base64data'),
}));

// expo-clipboard — plan 03 InviteCodeChip.tsx calls setStringAsync on Copy tap.
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

// expo-haptics — plan 03 InviteCodeChip.tsx fires a Success haptic after copy.
// Must expose the NotificationFeedbackType enum used by callers.
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// expo-camera — Phase 3 capture screen + admin video preview tests.
// Granted-by-default so capture-flow tests skip past the permission gate;
// permission-denied tests override the hook locally per-test.
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [
    { granted: true, status: 'granted', canAskAgain: true },
    jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  ],
  useMicrophonePermissions: () => [
    { granted: true, status: 'granted', canAskAgain: true },
    jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  ],
}));

// expo-video — Phase 3 admin queue video playback + capture review state.
// setup callback is invoked synchronously so loop/muted assertions work.
jest.mock('expo-video', () => ({
  useVideoPlayer: (_uri: string, setup?: (p: unknown) => void) => {
    const player = {
      muted: false,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      release: jest.fn(),
    };
    if (setup) setup(player);
    return player;
  },
  VideoView: 'VideoView',
}));

// @react-native-community/netinfo — Phase 3 upload queue auto-flush trigger.
// Default: connected + reachable. Per-test overrides via jest.spyOn.
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}));

// expo-blur — Phase 3 capture top-bar glassmorphism scrim.
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

// expo-linking — Phase 3 capture permission-denied screen calls
// Linking.openSettings(). Replaces any default jest-expo stub with a minimal
// surface that covers the methods Phase 3 uses.
jest.mock('expo-linking', () => ({
  openSettings: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(async () => null),
}));

// react-native-reanimated — official mock unlocks worklet test pattern
// (worklets become JS-thread-callable so SwipeCard gesture handlers can be
// invoked directly without simulating native events). Required by the
// SwipeCard.test.tsx and review.tsx integration tests in Plans 03-04 + 03-07.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// PER REVIEWS.md C4: stub crypto.randomUUID to a deterministic sequence so
// queue-entry tests (Plan 03-03) do not depend on Hermes entropy. The polyfill
// `react-native-get-random-values` is not loaded in Jest (no native bridge);
// we replace randomUUID with a counter-based RFC4122 v4 uuid so generated
// values are RFC-valid AND predictable for assertions.
{
  let uuidCounter = 0;
  const cryptoApi = globalThis as unknown as {
    crypto?: {
      randomUUID?: () => string;
      getRandomValues?: (a: Uint8Array) => Uint8Array;
    };
  };
  if (!cryptoApi.crypto) {
    (
      cryptoApi as {
        crypto: {
          randomUUID: () => string;
          getRandomValues: (a: Uint8Array) => Uint8Array;
        };
      }
    ).crypto = {
      randomUUID: () => '',
      getRandomValues: (a: Uint8Array) => a,
    };
  }
  cryptoApi.crypto!.randomUUID = () => {
    uuidCounter += 1;
    const hex = uuidCounter.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  };
}

// Ensure crypto.getRandomValues exists in jsdom/node env for aes-js
if (
  typeof (globalThis as { crypto?: Crypto }).crypto === 'undefined' ||
  !(globalThis as { crypto?: Crypto }).crypto?.getRandomValues
) {
  (globalThis as unknown as { crypto: Crypto }).crypto = (
    require('crypto') as { webcrypto: Crypto }
  ).webcrypto;
}
