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

// react-native-gesture-handler — hand-rolled minimal mock.
//
// Plan 03-07 introduced `react-native-gesture-handler` (peer of expo-router,
// installed via `npx expo install` during Plan 03-07 Task 1). The library's
// own `react-native-gesture-handler/jestSetup` mocks the native module but
// not the high-level `Gesture.Pan()` / `GestureDetector` API surface used by
// the admin review screen. The hand-rolled mock below covers:
// - `GestureDetector` — render children directly so the test tree includes them
// - `Gesture.Pan()` — chainable builder whose methods all return `this`
//
// Add to this surface as future plans adopt more gesture-handler APIs.
jest.mock('react-native-gesture-handler', () => {
  const RN = jest.requireActual('react-native');
  function makePan() {
    const builder: Record<string, unknown> = {};
    const chain = (..._args: unknown[]) => builder;
    [
      'activeOffsetX',
      'activeOffsetY',
      'failOffsetX',
      'failOffsetY',
      'enabled',
      'onUpdate',
      'onBegin',
      'onStart',
      'onEnd',
      'onFinalize',
      'minDistance',
      'minVelocity',
      'maxPointers',
      'minPointers',
      'shouldCancelWhenOutside',
    ].forEach((m) => {
      builder[m] = chain;
    });
    return builder;
  }
  return {
    __esModule: true,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: makePan, Tap: makePan },
    PanGestureHandler: RN.View,
    State: {},
    Directions: {},
    GestureHandlerRootView: RN.View,
  };
});

// react-native-reanimated — hand-rolled minimal mock.
//
// We do NOT use the upstream `react-native-reanimated/mock` re-export because
// (Reanimated 4.x) it transitively loads `./index` → `./initializers` →
// `react-native-worklets` which throws "Native part of Worklets doesn't seem
// to be initialized" inside Jest. Plan 03-01 added the upstream-mock line
// optimistically but never exercised it; first use in Plan 03-04
// (SwipeCard.test.tsx) surfaced the failure.
//
// The hand-rolled factory below covers the surface our components use:
// - default export: { View, Text, Image } pointing at RN counterparts
// - useSharedValue: returns a real { value } proxy
// - useAnimatedStyle: invokes the callback once and returns its result
// - SharedValue / Easing / interpolate stubs for accidental imports
//
// Add to this surface as more reanimated APIs are adopted.
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  function noop() {
    return undefined;
  }
  function identity(x: unknown) {
    return x;
  }
  function useSharedValue(init: unknown) {
    const box = { value: init };
    return new Proxy(box, {
      get(t, prop) {
        if (prop === 'value') return t.value;
        if (prop === 'get') return () => t.value;
        if (prop === 'set')
          return (next: unknown) => {
            if (typeof next === 'function') {
              const fn = next as Function;
              t.value = fn(t.value);
            } else {
              t.value = next;
            }
          };
        return undefined;
      },
      set(t, prop, next) {
        if (prop === 'value') {
          t.value = next;
          return true;
        }
        return false;
      },
    });
  }
  function useAnimatedStyle(cb: () => unknown) {
    return cb();
  }
  function passthrough(toValue: unknown) {
    return toValue;
  }
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    Image: RN.Image,
    ScrollView: RN.ScrollView,
    FlatList: RN.FlatList,
    createAnimatedComponent: identity,
  };
  return {
    __esModule: true,
    default: Animated,
    useSharedValue,
    useAnimatedStyle,
    useDerivedValue: (cb: () => unknown) => ({ value: cb() }),
    useAnimatedReaction: noop,
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => noop,
    runOnJS:
      (fn: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        fn(...args),
    runOnUI:
      (fn: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        fn(...args),
    withTiming: passthrough,
    withSpring: passthrough,
    withDecay: passthrough,
    cancelAnimation: noop,
    interpolate: noop,
    interpolateColor: noop,
    Easing: {
      linear: noop,
      ease: noop,
      in: identity,
      out: identity,
      inOut: identity,
      bezier: () => noop,
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    isSharedValue: () => false,
  };
});

// react-native LayoutAnimation — Phase 4 hooks call configureNext() to animate
// leaderboard row reorders and feed prepends. The native bridge is unavailable
// in jest, so stub the API.
// MEDIUM #4 (REVIEWS replan 2026-05-08): Presets.easeInEaseOut MUST be present
// because 04-05 calls LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut).
//
// Implementation note: jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), LayoutAnimation: ... }))
// would TRIPLE-init react-native and trip TurboModuleRegistry on DevMenu before
// jest-expo's NativeModule mocks apply. Instead, we patch LayoutAnimation on the
// already-loaded react-native module object — Node module cache means every
// later `require('react-native')` sees the patched LayoutAnimation, including
// 04-05's `import { LayoutAnimation } from 'react-native'`.
//
// Per-test files that fully replace `react-native` via
// `jest.mock('react-native', () => ({ AppState: ... }))` are unaffected because
// their mock REPLACES our patched module; they never see this LayoutAnimation
// surface anyway (their tests don't exercise it).
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  const layoutAnimationMock = {
    configureNext: jest.fn(),
    create: jest.fn((duration: number, type: string, prop: string) => ({
      duration,
      update: { type, property: prop },
      create: { type, property: prop },
      delete: { type, property: prop },
    })),
    Types: { easeInEaseOut: 'easeInEaseOut', linear: 'linear', spring: 'spring' },
    Properties: { opacity: 'opacity', scaleXY: 'scaleXY' },
    easeInEaseOut: 'easeInEaseOut',
    Presets: {
      easeInEaseOut: {
        duration: 250,
        update: { type: 'easeInEaseOut' },
        create: { type: 'easeInEaseOut', property: 'opacity' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      },
      linear: {
        duration: 500,
        update: { type: 'linear' },
        create: { type: 'linear', property: 'opacity' },
        delete: { type: 'linear', property: 'opacity' },
      },
      spring: {
        duration: 700,
        update: { type: 'spring', springDamping: 0.4 },
        create: { type: 'linear', property: 'opacity' },
        delete: { type: 'linear', property: 'opacity' },
      },
    },
  };
  try {
    Object.defineProperty(RN, 'LayoutAnimation', {
      configurable: true,
      writable: true,
      enumerable: true,
      value: layoutAnimationMock,
    });
  } catch {
    // RN's LayoutAnimation export uses an ES-module getter that may not be
    // writable — fall back to direct assignment on the cached module exports.
    (RN as { LayoutAnimation: typeof layoutAnimationMock }).LayoutAnimation = layoutAnimationMock;
  }
}

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
