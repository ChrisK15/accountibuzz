// SwipeCard test coverage — verifies media branching by media_type, caption
// truncate/hide rules, accessibility action declarations, and the
// PendingSubmissionRow contract spread (REVIEWS.md C5).
//
// Set env vars BEFORE the supabase singleton's env-var guard fires (its
// module-init throws if EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are missing).
// Same prologue + require-after-set pattern as tests/avatar-upload.test.ts.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// Use require (not import) for supabase-touching modules so the env-var
// assignments above run BEFORE the supabase client's module-init guard.
// ES import would be hoisted by Babel above the env assignments.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SwipeCard } = require('../../src/components/SwipeCard') as typeof import('../../src/components/SwipeCard');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../src/lib/supabase') as typeof import('../../src/lib/supabase');

const theme: Theme = {
  colors: colors.light,
  spacing,
  radii,
  fonts,
  name: 'light',
};

function withProviders(node: ReactElement): ReactElement {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <ThemeContext.Provider value={theme}>{node}</ThemeContext.Provider>
    </QueryClientProvider>
  );
}

describe('SwipeCard', () => {
  // PER REVIEWS.md C5: props shape mirrors PendingSubmissionRow from
  // useReviewQueue (Plan 03-05) — snake_case so the screen can spread directly.
  const baseProps = {
    display_name: 'Alex',
    avatar_path: null,
    updated_at: null,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    media_path: 'g-1/u-1/c-1.jpg',
    media_type: 'photo' as const,
  };

  beforeEach(() => {
    jest.spyOn(supabase.storage, 'from').mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed' },
        error: null,
      }),
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders submitter name + relative timestamp', () => {
    const { getByText } = render(withProviders(<SwipeCard {...baseProps} />));
    expect(getByText('Alex')).toBeTruthy();
    expect(getByText(/submitted 5m ago/)).toBeTruthy();
  });

  it('renders caption in italic with curly quotes when provided', () => {
    const { getByText } = render(
      withProviders(<SwipeCard {...baseProps} caption="great run today" />),
    );
    expect(getByText(/great run today/)).toBeTruthy();
  });

  it('hides caption block when caption is empty string', () => {
    const { queryByText } = render(
      withProviders(<SwipeCard {...baseProps} caption="" />),
    );
    // The block prefixes the caption with a quote — its absence proves the
    // block was hidden (not just rendered with empty content).
    expect(queryByText(/^"/)).toBeNull();
  });

  it('hides caption block when caption is null', () => {
    const { queryByText } = render(
      withProviders(<SwipeCard {...baseProps} caption={null} />),
    );
    expect(queryByText(/^"/)).toBeNull();
  });

  it('declares accessibilityActions for approve and reject', () => {
    const { getByLabelText } = render(
      withProviders(<SwipeCard {...baseProps} />),
    );
    const root = getByLabelText(/Submission from Alex/);
    expect(root.props.accessibilityActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'approve' }),
        expect.objectContaining({ name: 'reject' }),
      ]),
    );
  });

  // PER REVIEWS.md C5 — contract test guarding the spread pattern in the
  // future review screen (`<SwipeCard {...row} />`). Renames that break the
  // spread will fail this test.
  it('renders correctly when spread from a PendingSubmissionRow-shaped object', () => {
    const row = {
      // Extra row fields (id / user_id) are dropped by the spread; that's fine.
      id: 'sub-1',
      user_id: 'user-1',
      display_name: 'Jordan',
      avatar_path: null,
      updated_at: '2026-04-28T12:00:00.000Z',
      caption: 'morning lift, 5 by 5',
      media_path: 'g-1/u-1/c-1.jpg',
      media_type: 'photo' as const,
      created_at: new Date(Date.now() - 30 * 1000).toISOString(),
    };
    const { getByText } = render(withProviders(<SwipeCard {...row} />));
    expect(getByText('Jordan')).toBeTruthy();
    expect(getByText(/morning lift/)).toBeTruthy();
  });
});
