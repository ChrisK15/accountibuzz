process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test';
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));

import * as ImagePicker from 'expo-image-picker';
import { pickAndUploadAvatar } from '../src/features/profile/useAvatarUpload';
import { supabase } from '../src/lib/supabase';

describe('pickAndUploadAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('returns null when user cancels picker', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
    });
    await expect(pickAndUploadAvatar('user-1')).resolves.toBeNull();
  });
  it('uploads to avatars bucket at {userId}/avatar.jpg with upsert + contentType', async () => {
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
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://img.jpg' }],
    });
    const upload = jest.fn().mockResolvedValue({ error: new Error('nope') });
    jest.spyOn(supabase.storage, 'from').mockReturnValue({ upload } as never);
    await expect(pickAndUploadAvatar('user-1')).rejects.toBeTruthy();
  });
});
