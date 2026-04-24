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

// expo-file-system — minimal mock (plan 05 avatar upload pipeline).
// SDK 55 deprecated the top-level API; the production code imports from
// `expo-file-system/legacy`, so mock both paths.
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(async () => 'base64data'),
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

// Ensure crypto.getRandomValues exists in jsdom/node env for aes-js
if (
  typeof (globalThis as { crypto?: Crypto }).crypto === 'undefined' ||
  !(globalThis as { crypto?: Crypto }).crypto?.getRandomValues
) {
  (globalThis as unknown as { crypto: Crypto }).crypto = (
    require('crypto') as { webcrypto: Crypto }
  ).webcrypto;
}
