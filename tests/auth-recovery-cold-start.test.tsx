/**
 * WR-01 (iter 2) cold-start recovery test.
 *
 * Validates that AuthProvider hydrates `recoveryPending` from AsyncStorage
 * when a session is also restored from supabase-js. The approach uses react's
 * test renderer directly (@testing-library/react-native's render has been
 * flaky here with jest-expo + our minimal RN mock); we only need to capture
 * the context value, no DOM queries.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test';

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

async function flush() {
  // flush pending microtasks + setState effects
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mountAndRead(): Promise<any> {
  const {
    AuthProvider,
    useSession,
  } = require('../src/features/auth/AuthProvider');
  let captured: any = null;
  function Probe() {
    captured = useSession();
    return null;
  }
  let root: any;
  await act(async () => {
    root = TestRenderer.create(
      React.createElement(AuthProvider, null, React.createElement(Probe)),
    );
  });
  // Let the async getSession / AsyncStorage.getItem promises settle.
  await flush();
  await flush();
  return { captured: () => captured, root };
}

describe('AuthProvider cold-start recovery (WR-01)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores recoveryPending=true from AsyncStorage when a session is present on cold start', async () => {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.clear();
    await AsyncStorage.setItem('accountibuzz.recoveryPending', '1');

    const { supabase } = require('../src/lib/supabase');
    const fakeSession = { user: { id: 'u-1' } } as any;
    jest
      .spyOn(supabase.auth, 'getSession')
      .mockResolvedValue({ data: { session: fakeSession }, error: null } as any);
    jest
      .spyOn(supabase.auth, 'onAuthStateChange')
      .mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      } as any);

    const { captured } = await mountAndRead();
    const v = captured();
    expect(v).not.toBeNull();
    expect(v.loading).toBe(false);
    expect(v.session).toBe(fakeSession);
    // The gate in app/_layout.tsx reads this flag to pin /(auth)/reset-password.
    expect(v.recoveryPending).toBe(true);
  });

  it('does not treat a stale recovery flag as live when no session is restored', async () => {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.clear();
    await AsyncStorage.setItem('accountibuzz.recoveryPending', '1');

    const { supabase } = require('../src/lib/supabase');
    jest
      .spyOn(supabase.auth, 'getSession')
      .mockResolvedValue({ data: { session: null }, error: null } as any);
    jest
      .spyOn(supabase.auth, 'onAuthStateChange')
      .mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      } as any);

    const { captured } = await mountAndRead();
    const v = captured();
    expect(v.session).toBeNull();
    expect(v.recoveryPending).toBe(false);
  });

  it('recoveryPending stays false when no flag is persisted', async () => {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.clear();

    const { supabase } = require('../src/lib/supabase');
    const fakeSession = { user: { id: 'u-2' } } as any;
    jest
      .spyOn(supabase.auth, 'getSession')
      .mockResolvedValue({ data: { session: fakeSession }, error: null } as any);
    jest
      .spyOn(supabase.auth, 'onAuthStateChange')
      .mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      } as any);

    const { captured } = await mountAndRead();
    expect(captured().recoveryPending).toBe(false);
  });
});
