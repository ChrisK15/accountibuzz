// MediaViewer — fullscreen Modal viewer for FeedItem media.
// UI-SPEC line 546 (D-11) — fullscreen viewer integration.
//
// HIGH #11 cascade (REVIEWS replan 2026-05-08): consumes the shared
// useSignedMediaUrl from src/hooks so jest.spyOn(module) reaches it cleanly.
//
// MEDIUM useVideoPlayer (REVIEWS replan 2026-05-08): useVideoPlayer is called
// inside a child <VideoMediaView> rendered only when mediaType === 'video'
// AND signedUrl is non-empty — never called with an empty source.

// Stub Supabase env so `src/lib/supabase.ts` doesn't throw on import.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Replace the supabase singleton import via a virtual stub so
// useSignedMediaUrl is resolvable without booting AppState. Same pattern as
// FeedItem.test.tsx.
jest.mock('../../src/lib/supabase', () => {
  const storage = { from: jest.fn() };
  return { supabase: { storage } };
});

import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { MediaViewer } from '../../src/components/MediaViewer';
import * as useSignedMediaUrlModule from '../../src/hooks/useSignedMediaUrl';

const theme: Theme = {
  colors: colors.light,
  spacing,
  radii,
  fonts,
  name: 'light',
};

function withTheme(node: ReactElement) {
  return <ThemeContext.Provider value={theme}>{node}</ThemeContext.Provider>;
}

describe('MediaViewer', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders ActivityIndicator while signedUrl is pending', () => {
    jest
      .spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl')
      .mockReturnValue({ data: undefined, isPending: true } as never);
    const { UNSAFE_root } = render(
      withTheme(
        <MediaViewer
          mediaPath="u-1/2026-05-08/foo.jpg"
          mediaType="photo"
          onClose={jest.fn()}
        />,
      ),
    );
    // ActivityIndicator surface — the only element rendered while loading.
    const indicators = UNSAFE_root.findAll(
      (node: { type: unknown }) =>
        typeof node.type !== 'string' &&
        ((node.type as { displayName?: string })?.displayName ===
          'ActivityIndicator' ||
          ((node.type as { name?: string })?.name === 'ActivityIndicator')),
    );
    // Some test renderers expose ActivityIndicator as a string component name.
    const indicatorByString = UNSAFE_root.findAll(
      (node: { type: unknown }) =>
        typeof node.type === 'string' && node.type === 'ActivityIndicator',
    );
    expect(indicators.length + indicatorByString.length).toBeGreaterThan(0);
  });

  it('renders Image when photo signedUrl resolves', () => {
    jest
      .spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl')
      .mockReturnValue({
        data: 'https://example.com/foo.jpg',
        isPending: false,
        error: null,
      } as never);
    const { getByLabelText } = render(
      withTheme(
        <MediaViewer
          mediaPath="u-1/2026-05-08/foo.jpg"
          mediaType="photo"
          onClose={jest.fn()}
        />,
      ),
    );
    expect(getByLabelText('Submitted photo')).toBeTruthy();
  });

  it('renders VideoView when video signedUrl resolves', () => {
    jest
      .spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl')
      .mockReturnValue({
        data: 'https://example.com/foo.mp4',
        isPending: false,
        error: null,
      } as never);
    const { UNSAFE_root } = render(
      withTheme(
        <MediaViewer
          mediaPath="u-1/2026-05-08/foo.mp4"
          mediaType="video"
          onClose={jest.fn()}
        />,
      ),
    );
    // jest.setup.ts mocks expo-video with VideoView as the string 'VideoView'.
    const videoNodes = UNSAFE_root.findAll(
      (node: { type: unknown }) =>
        typeof node.type === 'string' && node.type === 'VideoView',
    );
    expect(videoNodes.length).toBeGreaterThan(0);
  });

  it('calls onClose when close button is pressed', () => {
    jest
      .spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl')
      .mockReturnValue({
        data: 'https://example.com/foo.jpg',
        isPending: false,
        error: null,
      } as never);
    const onClose = jest.fn();
    const { getByLabelText } = render(
      withTheme(
        <MediaViewer
          mediaPath="u-1/2026-05-08/foo.jpg"
          mediaType="photo"
          onClose={onClose}
        />,
      ),
    );
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
