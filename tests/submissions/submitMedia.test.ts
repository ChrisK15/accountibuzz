// Tests for the two-phase commit pipeline (D-06 + D-19).
// Mock pattern from tests/avatar-upload.test.ts: jest.spyOn(supabase.storage, 'from')
// + jest.spyOn(supabase, 'rpc'). The expo-file-system File class + expo-image-manipulator
// mocks are already in jest.setup.ts (Plan 03-01) — File.arrayBuffer() returns ArrayBuffer(8).

// Set env before require so the singleton's env-var guard passes (per
// tests/avatar-upload.test.ts pattern).
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

// Use require() so env vars + jest.mock() apply BEFORE supabase singleton loads.
// (TS `import` statements hoist above the env-setup lines, breaking the guard.)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { submitMedia } = require('../../src/features/submissions/submitMedia') as typeof import('../../src/features/submissions/submitMedia');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../src/lib/supabase') as typeof import('../../src/lib/supabase');

describe('submitMedia (two-phase commit pipeline)', () => {
  // RFC 4122 v4 fixtures (zod v4 .uuid() and the storage-path regex are both fine
  // with these — variant bits 8|9|a|b at position 17, version bits 1-8 at position 13).
  const validUserId = '11111111-1111-4111-8111-111111111111';
  const validGroupId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: validUserId } as never },
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('photo happy path: compress + upload + rpc returns submission_id', async () => {
    const uploadFn = jest.fn().mockResolvedValue({ error: null });
    jest.spyOn(supabase.storage, 'from').mockReturnValue({ upload: uploadFn } as never);
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: 'sub-uuid', error: null } as never);

    const id = await submitMedia({
      groupId: validGroupId,
      mediaLocalUri: 'file:///tmp/photo.jpg',
      mediaType: 'photo',
      caption: 'caption',
    });
    expect(id).toBe('sub-uuid');
    expect(supabase.storage.from).toHaveBeenCalledWith('submissions');
    expect(uploadFn).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^${validGroupId}/${validUserId}/[0-9a-f-]+\\.jpg$`),
      ),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'submit_today',
      expect.objectContaining({
        p_group_id: validGroupId,
        p_media_type: 'photo',
        p_caption: 'caption',
      }),
    );
  });

  it('video happy path: skip compression, upload as mp4', async () => {
    const uploadFn = jest.fn().mockResolvedValue({ error: null });
    jest.spyOn(supabase.storage, 'from').mockReturnValue({ upload: uploadFn } as never);
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: 'vid-sub-uuid', error: null } as never);

    const id = await submitMedia({
      groupId: validGroupId,
      mediaLocalUri: 'file:///tmp/video.mp4',
      mediaType: 'video',
      caption: null,
    });
    expect(id).toBe('vid-sub-uuid');
    expect(uploadFn).toHaveBeenCalledWith(
      expect.stringMatching(/\.mp4$/),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'video/mp4', upsert: false }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'submit_today',
      expect.objectContaining({
        p_group_id: validGroupId,
        p_media_type: 'video',
        p_caption: null,
      }),
    );
  });

  it('already-exists 409 falls through to RPC (idempotent retry)', async () => {
    const uploadFn = jest
      .fn()
      .mockResolvedValue({
        error: { message: 'The resource already exists', statusCode: '409' },
      });
    jest.spyOn(supabase.storage, 'from').mockReturnValue({ upload: uploadFn } as never);
    const rpcSpy = jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: 'sub-uuid', error: null } as never);

    const id = await submitMedia({
      groupId: validGroupId,
      mediaLocalUri: 'file:///tmp/photo.jpg',
      mediaType: 'photo',
      caption: null,
      clientUuid: '33333333-3333-4333-8333-333333333333',
    });
    expect(id).toBe('sub-uuid');
    // The 409 did NOT short-circuit; phase 2 still ran.
    expect(rpcSpy).toHaveBeenCalled();
  });

  it('storage network error re-throws', async () => {
    const networkErr = { message: 'Network request failed' };
    jest.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: networkErr }),
    } as never);
    await expect(
      submitMedia({
        groupId: validGroupId,
        mediaLocalUri: 'file:///tmp/photo.jpg',
        mediaType: 'photo',
        caption: null,
      }),
    ).rejects.toMatchObject({ message: 'Network request failed' });
  });

  it('typed RPC error (already_submitted_today) propagates as Error.message', async () => {
    jest.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
    } as never);
    jest.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'already_submitted_today' },
    } as never);
    await expect(
      submitMedia({
        groupId: validGroupId,
        mediaLocalUri: 'file:///tmp/photo.jpg',
        mediaType: 'photo',
        caption: null,
      }),
    ).rejects.toThrow('already_submitted_today');
  });

  it('typed RPC error (not_member) propagates as Error.message', async () => {
    jest.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
    } as never);
    jest.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'not_member' },
    } as never);
    await expect(
      submitMedia({
        groupId: validGroupId,
        mediaLocalUri: 'file:///tmp/photo.jpg',
        mediaType: 'photo',
        caption: null,
      }),
    ).rejects.toThrow('not_member');
  });

  it('not_authenticated throws when getUser returns null', async () => {
    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);
    await expect(
      submitMedia({
        groupId: validGroupId,
        mediaLocalUri: 'file:///tmp/photo.jpg',
        mediaType: 'photo',
        caption: null,
      }),
    ).rejects.toThrow('not_authenticated');
  });

  it('uses pre-supplied clientUuid in storage path (queue retry)', async () => {
    const fixedUuid = '44444444-4444-4444-8444-444444444444';
    const uploadFn = jest.fn().mockResolvedValue({ error: null });
    jest.spyOn(supabase.storage, 'from').mockReturnValue({ upload: uploadFn } as never);
    jest
      .spyOn(supabase, 'rpc')
      .mockResolvedValue({ data: 'sub-uuid', error: null } as never);

    await submitMedia({
      groupId: validGroupId,
      mediaLocalUri: 'file:///tmp/photo.jpg',
      mediaType: 'photo',
      caption: null,
      clientUuid: fixedUuid,
    });

    expect(uploadFn).toHaveBeenCalledWith(
      `${validGroupId}/${validUserId}/${fixedUuid}.jpg`,
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
  });
});
