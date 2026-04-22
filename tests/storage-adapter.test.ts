import { LargeSecureStore } from '../src/lib/storage-adapter';

describe('LargeSecureStore', () => {
  it('round-trips a value through encrypt + decrypt', async () => {
    const store = new LargeSecureStore();
    await store.setItem('session', 'hello world');
    await expect(store.getItem('session')).resolves.toBe('hello world');
  });

  it('returns null when the encryption key is missing', async () => {
    const store = new LargeSecureStore();
    await store.setItem('missing-key', 'x');
    await store.removeItem('missing-key');
    await expect(store.getItem('missing-key')).resolves.toBeNull();
  });

  it('removeItem clears both AsyncStorage and SecureStore', async () => {
    const SecureStore = require('expo-secure-store');
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const store = new LargeSecureStore();
    await store.setItem('k', 'v');
    await store.removeItem('k');
    await expect(AsyncStorage.getItem('k')).resolves.toBeNull();
    await expect(SecureStore.getItemAsync('k')).resolves.toBeNull();
  });
});
