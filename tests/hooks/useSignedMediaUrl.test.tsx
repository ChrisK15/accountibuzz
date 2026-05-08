// useSignedMediaUrl — shared spyable hook for the 'submissions' bucket.
// HIGH #11 from REVIEWS replan 2026-05-08: extracted from FeedItem so
// jest.spyOn(module, 'useSignedMediaUrl') works in consumer tests.

// Stub Supabase env so `src/lib/supabase.ts` doesn't throw on import.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Replace react-native with a minimal surface — supabase.ts pulls in AppState.
jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

import type { ComponentType, ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeWrapper(): ComponentType<{ children: ReactNode }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useSignedMediaUrl', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('does not query when path is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const fromSpy = jest.spyOn(supabase.storage, 'from');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      useSignedMediaUrl,
    } = require('../../src/hooks/useSignedMediaUrl');
    const { result } = renderHook(() => useSignedMediaUrl(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('calls createSignedUrl on the submissions bucket with TTL 60', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example.com/foo.jpg' },
      error: null,
    });
    const fromSpy = jest
      .spyOn(supabase.storage, 'from')
      .mockReturnValue({ createSignedUrl } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      useSignedMediaUrl,
    } = require('../../src/hooks/useSignedMediaUrl');
    const { result } = renderHook(
      () => useSignedMediaUrl('user/today/foo.jpg'),
      { wrapper: makeWrapper() },
    );
    await waitFor(() =>
      expect(result.current.data).toBe('https://signed.example.com/foo.jpg'),
    );
    expect(fromSpy).toHaveBeenCalledWith('submissions');
    expect(createSignedUrl).toHaveBeenCalledWith('user/today/foo.jpg', 60);
  });

  it('surfaces the error on failure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../src/lib/supabase');
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: null,
      error: new Error('not_authorized'),
    });
    jest
      .spyOn(supabase.storage, 'from')
      .mockReturnValue({ createSignedUrl } as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      useSignedMediaUrl,
    } = require('../../src/hooks/useSignedMediaUrl');
    const { result } = renderHook(
      () => useSignedMediaUrl('user/today/foo.jpg'),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});
