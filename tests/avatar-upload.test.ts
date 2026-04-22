// Set env before require so the singleton's env-var guard passes
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

describe('pickAndUploadAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('returns null when user cancels picker', async () => {
    const ImagePicker = require('expo-image-picker');
    const { pickAndUploadAvatar } = require('../src/features/profile/useAvatarUpload');
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
    });
    await expect(pickAndUploadAvatar('user-1')).resolves.toBeNull();
  });

  it('uploads to avatars bucket at {userId}/avatar.jpg with upsert + contentType', async () => {
    const ImagePicker = require('expo-image-picker');
    const { pickAndUploadAvatar } = require('../src/features/profile/useAvatarUpload');
    const { supabase } = require('../src/lib/supabase');

    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://img.heic' }],
    });
    const upload = jest.fn().mockResolvedValue({ error: null });
    const update = jest
      .fn()
      .mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    jest.spyOn(supabase.storage, 'from').mockReturnValue({ upload } as never);
    jest.spyOn(supabase, 'from').mockReturnValue({ update } as never);

    const path = await pickAndUploadAvatar('user-1');
    expect(path).toBe('user-1/avatar.jpg');
    expect(supabase.storage.from).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledWith(
      'user-1/avatar.jpg',
      expect.anything(),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    );
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('throws when storage upload errors (does not swallow)', async () => {
    const ImagePicker = require('expo-image-picker');
    const { pickAndUploadAvatar } = require('../src/features/profile/useAvatarUpload');
    const { supabase } = require('../src/lib/supabase');

    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://img.jpg' }],
    });
    const upload = jest.fn().mockResolvedValue({ error: new Error('nope') });
    jest.spyOn(supabase.storage, 'from').mockReturnValue({ upload } as never);
    await expect(pickAndUploadAvatar('user-1')).rejects.toBeTruthy();
  });
});
