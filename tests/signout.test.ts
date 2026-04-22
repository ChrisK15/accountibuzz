process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test';
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));

describe('supabase.auth.signOut', () => {
  it('is exposed on the singleton client', () => {
    const { supabase } = require('../src/lib/supabase');
    expect(typeof supabase.auth.signOut).toBe('function');
  });
  it('invokes successfully when mocked', async () => {
    const { supabase } = require('../src/lib/supabase');
    jest
      .spyOn(supabase.auth, 'signOut')
      .mockResolvedValue({ error: null } as any);
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
  });
});
