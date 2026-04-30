// Mutation tests for useSubmitToday. Covers SUB-03 (network resilience) +
// REVIEWS C4 (uuid_unavailable typed-error fail-hard).
//
// Test cases:
//   1. happy path: returns submission_id, invalidates ['submission', groupId, 'today']
//   2. typed error already_submitted_today propagates unchanged (no enqueue)
//   3. typed error not_member propagates unchanged (no enqueue)
//   4. typed error caption_too_long propagates unchanged (no enqueue)
//   5. network error → enqueue + throw 'queued' marker
//   6. PER REVIEWS C4: uuid_unavailable typed error when crypto.randomUUID is missing
//      (no enqueue, no fallback string)

// Set env BEFORE require so the supabase singleton's env-var guard passes.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

// Mock submitMedia at module-scope so we can drive its behavior per-test.
jest.mock('../../src/features/submissions/submitMedia', () => ({
  submitMedia: jest.fn(),
}));

import type { ComponentType, ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { submitMedia } = require('../../src/features/submissions/submitMedia');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const queueModule = require('../../src/features/submissions/uploadQueueManager') as typeof import('../../src/features/submissions/uploadQueueManager');

const validGroupId = '22222222-2222-4222-8222-222222222222';
const detUuidPrefix = '00000000-0000-4000-8000-'; // jest.setup.ts deterministic stub

function makeWrapper(): { wrapper: ComponentType<{ children: ReactNode }>; client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
  return { wrapper, client };
}

describe('useSubmitToday', () => {
  beforeEach(async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    (submitMedia as jest.Mock).mockReset();
    // Clear AsyncStorage queue between tests so enqueue assertions are clean.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage')
      .default as typeof import('@react-native-async-storage/async-storage').default;
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('happy path: returns submission_id and invalidates the today cache', async () => {
    (submitMedia as jest.Mock).mockResolvedValue('sub-uuid-1');
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSubmitToday } = require('../../src/features/submissions/useSubmitToday');
    const { result } = renderHook(() => useSubmitToday(), { wrapper });

    let returned: string | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        groupId: validGroupId,
        mediaLocalUri: 'file:///tmp/photo.jpg',
        mediaType: 'photo',
        caption: null,
      });
    });
    expect(returned).toBe('sub-uuid-1');

    // submitMedia received a deterministic-stub uuid (no fallback string concat).
    const callArgs = (submitMedia as jest.Mock).mock.calls[0][0];
    expect(callArgs.clientUuid).toMatch(/^00000000-0000-4000-8000-[0-9a-f]{12}$/);

    // Invalidated the today cache.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['submission', validGroupId, 'today'],
    });
  });

  it('typed error already_submitted_today propagates unchanged (no enqueue)', async () => {
    (submitMedia as jest.Mock).mockRejectedValue(new Error('already_submitted_today'));
    const { wrapper } = makeWrapper();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSubmitToday } = require('../../src/features/submissions/useSubmitToday');
    const { result } = renderHook(() => useSubmitToday(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          groupId: validGroupId,
          mediaLocalUri: 'file:///tmp/photo.jpg',
          mediaType: 'photo',
          caption: null,
        }),
      ).rejects.toThrow('already_submitted_today');
    });

    // No queue entry was written.
    const queue = await queueModule.readQueue();
    expect(queue).toHaveLength(0);
  });

  it('typed error not_member propagates unchanged (no enqueue)', async () => {
    (submitMedia as jest.Mock).mockRejectedValue(new Error('not_member'));
    const { wrapper } = makeWrapper();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSubmitToday } = require('../../src/features/submissions/useSubmitToday');
    const { result } = renderHook(() => useSubmitToday(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          groupId: validGroupId,
          mediaLocalUri: 'file:///tmp/photo.jpg',
          mediaType: 'photo',
          caption: null,
        }),
      ).rejects.toThrow('not_member');
    });

    const queue = await queueModule.readQueue();
    expect(queue).toHaveLength(0);
  });

  it('typed error caption_too_long propagates unchanged (no enqueue)', async () => {
    (submitMedia as jest.Mock).mockRejectedValue(new Error('caption_too_long'));
    const { wrapper } = makeWrapper();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSubmitToday } = require('../../src/features/submissions/useSubmitToday');
    const { result } = renderHook(() => useSubmitToday(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          groupId: validGroupId,
          mediaLocalUri: 'file:///tmp/photo.jpg',
          mediaType: 'photo',
          caption: 'x'.repeat(141),
        }),
      ).rejects.toThrow('caption_too_long');
    });

    const queue = await queueModule.readQueue();
    expect(queue).toHaveLength(0);
  });

  it('network error → enqueues + throws Error("queued") + invalidates uploadQueue cache', async () => {
    (submitMedia as jest.Mock).mockRejectedValue(new Error('Network request failed'));
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSubmitToday } = require('../../src/features/submissions/useSubmitToday');
    const { result } = renderHook(() => useSubmitToday(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          groupId: validGroupId,
          mediaLocalUri: 'file:///tmp/photo.jpg',
          mediaType: 'photo',
          caption: null,
        }),
      ).rejects.toThrow('queued');
    });

    // Queue has 1 entry with deterministic uuid (RFC4122 v4 — no fallback string).
    const queue = await queueModule.readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].client_uuid).toMatch(/^00000000-0000-4000-8000-[0-9a-f]{12}$/);
    expect(queue[0].group_id).toBe(validGroupId);
    expect(queue[0].media_type).toBe('photo');

    // The uploadQueue TanStack cache was invalidated so QueueBadge shows.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['uploadQueue'] });
  });

  it('PER REVIEWS C4: throws uuid_unavailable when crypto.randomUUID is missing (no enqueue)', async () => {
    // Surgically disable randomUUID for this test; restore in finally.
    // NOTE: webcrypto's randomUUID is non-configurable in Node, so `delete` is a
    // no-op (the value reappears from the prototype). Assign undefined instead —
    // newClientUuid checks `if (!cryptoApi?.randomUUID)` which catches that.
    const cryptoApi = (globalThis as unknown as { crypto: { randomUUID?: () => string } }).crypto;
    const original = cryptoApi.randomUUID;
    cryptoApi.randomUUID = undefined;

    try {
      // submitMedia must NOT be called (we never get past newClientUuid).
      (submitMedia as jest.Mock).mockResolvedValue('should-not-reach');
      const { wrapper } = makeWrapper();

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useSubmitToday } = require('../../src/features/submissions/useSubmitToday');
      const { result } = renderHook(() => useSubmitToday(), { wrapper });

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            groupId: validGroupId,
            mediaLocalUri: 'file:///tmp/photo.jpg',
            mediaType: 'photo',
            caption: null,
          }),
        ).rejects.toThrow('uuid_unavailable');
      });

      // submitMedia was never reached.
      expect(submitMedia).not.toHaveBeenCalled();

      // CRITICAL: NO queue entry was written. Without this fail-hard, a
      // fallback string would have been enqueued and corrupted readQueue.
      const queue = await queueModule.readQueue();
      expect(queue).toHaveLength(0);
    } finally {
      cryptoApi.randomUUID = original;
    }
  });
});
