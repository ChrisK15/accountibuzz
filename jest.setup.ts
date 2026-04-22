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

// Ensure crypto.getRandomValues exists in jsdom/node env for aes-js
if (
  typeof (globalThis as { crypto?: Crypto }).crypto === 'undefined' ||
  !(globalThis as { crypto?: Crypto }).crypto?.getRandomValues
) {
  (globalThis as unknown as { crypto: Crypto }).crypto = (
    require('crypto') as { webcrypto: Crypto }
  ).webcrypto;
}
