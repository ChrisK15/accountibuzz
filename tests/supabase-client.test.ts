// Set env before require so the singleton's env-var guard passes
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

describe('supabase client config', () => {
  it('has RN-safe auth config', () => {
    const { supabase } = require('../src/lib/supabase');
    expect(supabase).toBeDefined();
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
  });

  it('registers AppState listener for auto-refresh', () => {
    const { AppState } = require('react-native');
    require('../src/lib/supabase');
    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });
});
