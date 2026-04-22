process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test';

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));

describe('supabase.auth.signUp wiring', () => {
  it('signUp is callable on the exported client', () => {
    const { supabase } = require('../src/lib/supabase');
    expect(typeof supabase.auth.signUp).toBe('function');
  });
  it('signIn + signOut round-trip via mocked client', async () => {
    const { supabase } = require('../src/lib/supabase');
    jest
      .spyOn(supabase.auth, 'signInWithPassword')
      .mockResolvedValue({
        data: { session: {} as any, user: {} as any },
        error: null,
      } as any);
    const res = await supabase.auth.signInWithPassword({
      email: 'a@b.co',
      password: 'x',
    });
    expect(res.error).toBeNull();
  });
});
