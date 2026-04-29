// Tests for the AsyncStorage-backed upload queue + AppState/NetInfo trigger wiring.
// Mock pattern from tests/auth-recovery-cold-start.test.tsx (storage-backed lifecycle).

// Set env before require so the singleton's env-var guard passes.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock react-native AppState BEFORE the queue module is required, so the spy
// captures the addEventListener call performed inside startQueueManager.
// Babel-jest hoists jest.mock() above all module-scope statements but allows
// closure-references to variables prefixed `mock` (case-insensitive).
const mockAppStateSub = { remove: jest.fn() };
const mockAppStateAddEventListener = jest.fn(() => mockAppStateSub);
jest.mock('react-native', () => ({
  AppState: { addEventListener: mockAppStateAddEventListener },
}));

const mockNetInfoUnsubscribe = jest.fn();
const mockNetInfoAddEventListener = jest.fn(() => mockNetInfoUnsubscribe);
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: mockNetInfoAddEventListener,
    fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
  addEventListener: mockNetInfoAddEventListener,
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AsyncStorage = require('@react-native-async-storage/async-storage')
  .default as typeof import('@react-native-async-storage/async-storage').default;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const queueModule = require('../../src/features/submissions/uploadQueueManager') as typeof import('../../src/features/submissions/uploadQueueManager');
const { QUEUE_KEY, readQueue, enqueue, dequeue, flushQueue, startQueueManager } =
  queueModule;
type QueueEntry = import('../../src/features/submissions/uploadQueueManager').QueueEntry;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../src/lib/supabase') as typeof import('../../src/lib/supabase');

const validEntry: QueueEntry = {
  client_uuid: '11111111-1111-4111-8111-111111111111',
  group_id: '22222222-2222-4222-8222-222222222222',
  media_local_uri: 'file:///tmp/photo.jpg',
  media_type: 'photo',
  caption: 'caption',
  created_at_iso: '2026-04-28T20:00:00.000Z',
};

describe('uploadQueueManager', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    mockAppStateAddEventListener.mockClear();
    mockNetInfoAddEventListener.mockClear();
    mockAppStateSub.remove.mockClear();
    mockNetInfoUnsubscribe.mockClear();
  });

  describe('readQueue / enqueue / dequeue', () => {
    it('returns empty array when nothing stored', async () => {
      expect(await readQueue()).toEqual([]);
    });

    it('enqueue + readQueue round-trips', async () => {
      await enqueue(validEntry);
      const q = await readQueue();
      expect(q).toEqual([validEntry]);
    });

    it('enqueue de-dupes by client_uuid (first wins)', async () => {
      await enqueue(validEntry);
      await enqueue({ ...validEntry, caption: 'different caption' }); // same client_uuid
      const q = await readQueue();
      expect(q).toHaveLength(1);
      expect(q[0].caption).toBe('caption');
    });

    it('dequeue removes by client_uuid', async () => {
      await enqueue(validEntry);
      await enqueue({
        ...validEntry,
        client_uuid: '33333333-3333-4333-8333-333333333333',
      });
      await dequeue(validEntry.client_uuid);
      const q = await readQueue();
      expect(q).toHaveLength(1);
      expect(q[0].client_uuid).toBe('33333333-3333-4333-8333-333333333333');
    });

    it('readQueue resets on non-JSON value (Pitfall 4)', async () => {
      await AsyncStorage.setItem(QUEUE_KEY, 'this is not valid JSON');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const q = await readQueue();
      expect(q).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not valid JSON'),
      );
      expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();
    });

    it('readQueue resets when stored value is not an array', async () => {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify({ not: 'an array' }));
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await readQueue()).toEqual([]);
      expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();
    });

    // PER REVIEWS.md C4: per-entry validation isolates corruption blast radius.
    it('readQueue drops malformed entries but preserves valid ones', async () => {
      const malformedMissingField = {
        client_uuid: '99999999-9999-4999-8999-999999999999',
        // group_id missing
      };
      const malformedBadUuid = { ...validEntry, client_uuid: 'not-a-uuid' };
      await AsyncStorage.setItem(
        QUEUE_KEY,
        JSON.stringify([validEntry, malformedMissingField, malformedBadUuid]),
      );
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const q = await readQueue();

      // Only the valid entry survives.
      expect(q).toHaveLength(1);
      expect(q[0].client_uuid).toBe(validEntry.client_uuid);
      // The dropped count was logged.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dropping 2 malformed entries'),
      );
      // The cleaned queue was persisted.
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      expect(stored).not.toBeNull();
      const reparsed = JSON.parse(stored!);
      expect(reparsed).toHaveLength(1);
    });
  });

  describe('flushQueue', () => {
    const session = {
      user: { id: '99999999-9999-4999-8999-999999999999' },
    } as never;

    it('no-op when session is null', async () => {
      await enqueue(validEntry);
      await flushQueue(null);
      expect((await readQueue()).length).toBe(1); // entry retained
    });

    it('removes entry on submitMedia success', async () => {
      await enqueue(validEntry);
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: '99999999-9999-4999-8999-999999999999' } as never },
        error: null,
      });
      jest.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
      } as never);
      jest
        .spyOn(supabase, 'rpc')
        .mockResolvedValue({ data: 'sub-uuid', error: null } as never);

      await flushQueue(session);
      expect(await readQueue()).toEqual([]);
    });

    it('drops entry on already_submitted_today', async () => {
      await enqueue(validEntry);
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: '99999999-9999-4999-8999-999999999999' } as never },
        error: null,
      });
      jest.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
      } as never);
      jest.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'already_submitted_today' },
      } as never);

      await flushQueue(session);
      expect(await readQueue()).toEqual([]);
    });

    it('drops entry on not_member', async () => {
      await enqueue(validEntry);
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: '99999999-9999-4999-8999-999999999999' } as never },
        error: null,
      });
      jest.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
      } as never);
      jest.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'not_member' },
      } as never);

      await flushQueue(session);
      expect(await readQueue()).toEqual([]);
    });

    it('drops entry on wrong_media_type', async () => {
      await enqueue(validEntry);
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: '99999999-9999-4999-8999-999999999999' } as never },
        error: null,
      });
      jest.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
      } as never);
      jest.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'wrong_media_type' },
      } as never);

      await flushQueue(session);
      expect(await readQueue()).toEqual([]);
    });

    it('retains entry on network error AND stops iteration before next entry', async () => {
      await enqueue(validEntry);
      await enqueue({
        ...validEntry,
        client_uuid: '33333333-3333-4333-8333-333333333333',
      });
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: '99999999-9999-4999-8999-999999999999' } as never },
        error: null,
      });
      jest.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          error: { message: 'Network request failed' },
        }),
      } as never);
      const rpcSpy = jest.spyOn(supabase, 'rpc');

      await flushQueue(session);
      // Both entries retained (first failed, iteration stopped before second).
      expect((await readQueue()).length).toBe(2);
      // RPC was never called for the second entry.
      expect(rpcSpy).not.toHaveBeenCalled();
    });
  });

  // PER REVIEWS.md C8: startQueueManager is exercised directly here (not via
  // integration). The previous "this plan does NOT test startQueueManager"
  // claim contradicted the must_haves truth that AppState/NetInfo triggers
  // ARE covered by this plan.
  describe('startQueueManager', () => {
    it('registers AppState and NetInfo listeners on call', () => {
      startQueueManager(() => null);
      expect(mockAppStateAddEventListener).toHaveBeenCalledTimes(1);
      expect(mockAppStateAddEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(mockNetInfoAddEventListener).toHaveBeenCalledTimes(1);
      expect(mockNetInfoAddEventListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it('AppState "active" handler triggers flushQueue', async () => {
      await enqueue(validEntry);
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'u-1' } as never },
        error: null,
      });
      jest.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
      } as never);
      jest
        .spyOn(supabase, 'rpc')
        .mockResolvedValue({ data: 'sub-uuid', error: null } as never);

      const session = { user: { id: 'u-1' } } as never;
      startQueueManager(() => session);

      // Pull the registered handler and simulate "app became active".
      const [, appStateHandler] = mockAppStateAddEventListener.mock.calls[0] as unknown as [
        string,
        (s: string) => void,
      ];
      appStateHandler('active');
      // Wait for the async flush to complete.
      await new Promise((r) => setImmediate(r));

      expect(await readQueue()).toEqual([]);
    });

    it('AppState non-active state does NOT trigger flush', () => {
      startQueueManager(() => ({ user: { id: 'u-1' } } as never));
      const upload = jest.spyOn(supabase.storage, 'from');
      const [, appStateHandler] = mockAppStateAddEventListener.mock.calls[0] as unknown as [
        string,
        (s: string) => void,
      ];
      appStateHandler('background');
      appStateHandler('inactive');
      expect(upload).not.toHaveBeenCalled();
    });

    it('NetInfo isConnected+reachable handler triggers flushQueue', async () => {
      await enqueue(validEntry);
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'u-1' } as never },
        error: null,
      });
      jest.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
      } as never);
      jest
        .spyOn(supabase, 'rpc')
        .mockResolvedValue({ data: 'sub-uuid', error: null } as never);

      startQueueManager(() => ({ user: { id: 'u-1' } } as never));
      const [netInfoHandler] = mockNetInfoAddEventListener.mock.calls[0] as unknown as [
        (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void,
      ];
      netInfoHandler({ isConnected: true, isInternetReachable: true });
      await new Promise((r) => setImmediate(r));

      expect(await readQueue()).toEqual([]);
    });

    it('NetInfo isConnected:false does NOT trigger flush', () => {
      startQueueManager(() => ({ user: { id: 'u-1' } } as never));
      const upload = jest.spyOn(supabase.storage, 'from');
      const [netInfoHandler] = mockNetInfoAddEventListener.mock.calls[0] as unknown as [
        (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void,
      ];
      netInfoHandler({ isConnected: false, isInternetReachable: false });
      expect(upload).not.toHaveBeenCalled();
    });

    it('cleanup function unsubscribes both listeners', () => {
      const cleanup = startQueueManager(() => ({ user: { id: 'u-1' } } as never));
      cleanup();
      expect(mockAppStateSub.remove).toHaveBeenCalled();
      expect(mockNetInfoUnsubscribe).toHaveBeenCalled();
    });
  });
});
