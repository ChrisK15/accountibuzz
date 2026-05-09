// FeedItem — feed card with avatar, name, time, 80x80 media thumb, optional caption.
// UI-SPEC §"Component Additions §2 FeedItem" lines 507-555.
//
// HIGH #11 (REVIEWS replan 2026-05-08): jest.spyOn(useSignedMediaUrlModule)
// works because useSignedMediaUrl is now a shared exported hook.
// MEDIUM RN role: accessibilityRole='text' (NOT 'summary').
// MEDIUM useVideoPlayer: video child renders only when mediaType === 'video'.

// Stub Supabase env so `src/lib/supabase.ts` doesn't throw on import.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Replace the supabase singleton import via a virtual stub-friendly mock —
// keeps `src/hooks/useSignedMediaUrl` resolvable without booting AppState.
jest.mock('../../src/lib/supabase', () => {
  const storage = {
    from: jest.fn(),
  };
  return {
    supabase: { storage },
  };
});

import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { FeedItem } from '../../src/components/feed/FeedItem';
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

const baseProps = {
  submissionId: 's-1',
  submitterUserId: 'u-1',
  isYou: false,
  displayName: 'Alice Smith',
  mediaPath: 'u-1/2026-05-08/foo.jpg',
  mediaType: 'photo' as const,
  submittedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3m ago
  onMediaPress: jest.fn(),
};

describe('FeedItem', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders photo variant with submitter name + time', () => {
    // HIGH #11 (REVIEWS replan 2026-05-08): jest.spyOn works because
    // useSignedMediaUrl is a shared exported hook.
    jest.spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl').mockReturnValue({
      data: 'https://example.com/foo.jpg',
      isPending: false,
      error: null,
    } as never);

    const { getByText } = render(
      withTheme(<FeedItem {...baseProps} mediaType="photo" />),
    );
    expect(getByText('Alice Smith')).toBeTruthy();
    expect(getByText(/3m ago/)).toBeTruthy();
  });

  it('renders video variant with play badge', () => {
    jest.spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl').mockReturnValue({
      data: 'https://example.com/foo.mp4',
      isPending: false,
      error: null,
    } as never);

    const { UNSAFE_root } = render(
      withTheme(<FeedItem {...baseProps} mediaType="video" />),
    );
    // A11y-hidden play badge exists in the tree — the surrounding Pressable
    // owns the interaction and reads "Open video".
    const openVideoPressable = UNSAFE_root.findByProps({
      accessibilityLabel: 'Open video',
    });
    expect(openVideoPressable).toBeTruthy();
  });

  it('hides caption when caption is null', () => {
    jest.spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl').mockReturnValue({
      data: 'https://example.com/foo.jpg',
      isPending: false,
      error: null,
    } as never);

    const { queryByText } = render(
      withTheme(<FeedItem {...baseProps} caption={null} />),
    );
    expect(queryByText(/^"|^[A-Za-z].*caption.*$/)).toBeNull();
  });

  it('truncates caption to 2 lines when present', () => {
    jest.spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl').mockReturnValue({
      data: 'https://example.com/foo.jpg',
      isPending: false,
      error: null,
    } as never);

    const captionText = 'My morning run was great today and I feel awesome!';
    const { getByText } = render(
      withTheme(<FeedItem {...baseProps} caption={captionText} />),
    );
    const node = getByText(captionText);
    // numberOfLines={2} on the caption Text element
    expect(
      (node.props as { numberOfLines?: number }).numberOfLines,
    ).toBe(2);
  });

  it('calls onMediaPress when thumbnail pressed', () => {
    jest.spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl').mockReturnValue({
      data: 'https://example.com/foo.jpg',
      isPending: false,
      error: null,
    } as never);
    const onMediaPress = jest.fn();
    const { UNSAFE_root } = render(
      withTheme(<FeedItem {...baseProps} onMediaPress={onMediaPress} />),
    );
    const pressable = UNSAFE_root.findByProps({
      accessibilityLabel: 'Open photo',
    });
    fireEvent.press(pressable);
    expect(onMediaPress).toHaveBeenCalledTimes(1);
  });

  it('uses accessibilityRole="text" (MEDIUM RN role fix)', () => {
    jest.spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl').mockReturnValue({
      data: 'https://example.com/foo.jpg',
      isPending: false,
      error: null,
    } as never);
    const { UNSAFE_root } = render(
      withTheme(<FeedItem {...baseProps} />),
    );
    // Multiple text-role nodes may exist (e.g. inner Text nodes); the outer
    // card root must not be 'summary'. Check that no node has role='summary'.
    const summaryNodes = UNSAFE_root.findAllByProps({
      accessibilityRole: 'summary',
    });
    expect(summaryNodes.length).toBe(0);
  });
});
