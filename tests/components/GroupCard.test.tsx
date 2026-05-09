// GroupCard state-matrix coverage — verifies status × queuedUploadSize × kind
// → CTA branching per UI-SPEC §State Matrix (lines 982-993).

import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { GroupCard } from '../../src/components/GroupCard';

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
  groupId: 'g-1',
  name: 'Morning runners',
  goal: 'Daily run photo',
  kind: 'photo' as const,
  status: 'none' as const,
  cutoffTime: '12:00 AM',
  minutesLeft: 240,
};

describe('GroupCard state matrix', () => {
  beforeEach(() => jest.clearAllMocks());

  it('status=none + photo → "Submit photo" CTA fires onSubmitPress', () => {
    const onSubmitPress = jest.fn();
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="none"
          kind="photo"
          onSubmitPress={onSubmitPress}
        />,
      ),
    );
    const cta = getByText('Submit photo');
    expect(cta).toBeTruthy();
    fireEvent.press(cta);
    expect(onSubmitPress).toHaveBeenCalledTimes(1);
  });

  it('status=none + video → "Submit video" CTA', () => {
    const { getByText } = render(
      withTheme(
        <GroupCard {...baseProps} kind="video" onSubmitPress={() => {}} />,
      ),
    );
    expect(getByText('Submit video')).toBeTruthy();
  });

  it('status=pending → "Submitted" disabled CTA + "Pending review" pill', () => {
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="pending"
          submittedAgo="2m ago"
          onSubmitPress={() => {}}
        />,
      ),
    );
    expect(getByText('Submitted')).toBeTruthy();
    expect(getByText('Pending review')).toBeTruthy();
  });

  it('status=approved → "Submitted" disabled CTA + "Approved" pill', () => {
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="approved"
          submittedAgo="1h ago"
          onSubmitPress={() => {}}
        />,
      ),
    );
    expect(getByText('Submitted')).toBeTruthy();
    expect(getByText('Approved')).toBeTruthy();
  });

  it("status=rejected → \"Today didn't count\" CTA renders + rejected pill is tappable when reason+handler provided", () => {
    const onRejectedPillPress = jest.fn();
    const { getAllByText, getByRole } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="rejected"
          rejectionReason="not today's run"
          onRejectedPillPress={onRejectedPillPress}
          onSubmitPress={() => {}}
        />,
      ),
    );
    // Both the disabled CTA and the interactive pill carry the same text.
    const matches = getAllByText("Today didn't count");
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Two role=button elements carry the "Today didn't count" text — the disabled
    // GhostButton CTA and the interactive StatusPill. The pill's a11y label
    // includes "Tap to see admin's note", which uniquely identifies it.
    const pill = getByRole('button', { name: /Tap to see admin's note/ });
    fireEvent.press(pill);
    expect(onRejectedPillPress).toHaveBeenCalledTimes(1);
  });

  it('queuedUploadSize provided → inline QueueBadge renders with size text', () => {
    const onQueueBadgeMorePress = jest.fn();
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="pending"
          submittedAgo="2m ago"
          queuedUploadSize="2.4 MB"
          onQueueBadgeMorePress={onQueueBadgeMorePress}
          onSubmitPress={() => {}}
        />,
      ),
    );
    expect(getByText(/Upload pending — 2\.4 MB queued/)).toBeTruthy();
  });

  it('queuedUploadSize undefined → QueueBadge NOT rendered', () => {
    const { queryByText } = render(
      withTheme(
        <GroupCard {...baseProps} status="none" onSubmitPress={() => {}} />,
      ),
    );
    expect(queryByText(/Upload pending/)).toBeNull();
  });
});

// Phase 4 D-13/D-14 — social prop coverage. Backward-compatible: when `social`
// is undefined, GroupCard renders byte-identically to its P3 shape.
// The InlineSocialSignal cluster is `accessibilityElementsHidden=true`
// (UI-SPEC line 885 — its text is appended to the parent's composite a11y
// label to avoid double-reading). testing-library's `getByText` filters
// such subtrees out by default, so we walk the rendered JSON tree directly
// to find substrings inside hidden subtrees.
function collectAllText(root: unknown): string[] {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (!node) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    const obj = node as { children?: unknown };
    if (Array.isArray(obj.children)) {
      for (const c of obj.children) walk(c);
    }
  }
  walk(root);
  return out;
}

describe('GroupCard with social prop', () => {
  it('renders default variant — "{posted}/{total} posted · {points} pts · 🔥{streak}"', () => {
    const { toJSON } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="none"
          onSubmitPress={() => {}}
          social={{ posted: 4, total: 6, points: 11, streak: 3 }}
        />,
      ),
    );
    const all = collectAllText(toJSON());
    expect(all).toContain('4/6 posted');
    expect(all).toContain('11 pts');
    expect(all).toContain('🔥3');
  });

  it('renders be-the-first variant when posted === 0', () => {
    const { toJSON } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="none"
          onSubmitPress={() => {}}
          social={{ posted: 0, total: 5, points: 0, streak: 0 }}
        />,
      ),
    );
    const all = collectAllText(toJSON());
    expect(all.some((s) => s.includes('0/5 posted'))).toBe(true);
    expect(all).toContain('be the first');
    // be-the-first variant DROPS points + streak fragments per UI-SPEC line 290.
    expect(all.some((s) => /pts/.test(s))).toBe(false);
  });

  it('renders streak-broken variant — points + 🔥0 still shown', () => {
    const { toJSON } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="approved"
          submittedAgo="1h ago"
          onSubmitPress={() => {}}
          social={{ posted: 2, total: 8, points: 7, streak: 0 }}
        />,
      ),
    );
    const all = collectAllText(toJSON());
    expect(all).toContain('2/8 posted');
    expect(all).toContain('7 pts');
    expect(all).toContain('🔥0');
  });

  it('renders full-house variant — same as default', () => {
    const { toJSON } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="approved"
          onSubmitPress={() => {}}
          social={{ posted: 6, total: 6, points: 18, streak: 7 }}
        />,
      ),
    );
    const all = collectAllText(toJSON());
    expect(all).toContain('6/6 posted');
    expect(all).toContain('18 pts');
    expect(all).toContain('🔥7');
  });

  it('omits social line when total === 0 (defensive — preserves P3 shape)', () => {
    const { toJSON } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="none"
          onSubmitPress={() => {}}
          social={{ posted: 0, total: 0, points: 0, streak: 0 }}
        />,
      ),
    );
    const all = collectAllText(toJSON());
    expect(all.some((s) => /posted/.test(s))).toBe(false);
    expect(all.some((s) => /be the first/.test(s))).toBe(false);
  });

  it('omits social line entirely when social prop is undefined (P3 byte-identical)', () => {
    const { toJSON } = render(
      withTheme(
        <GroupCard {...baseProps} status="none" onSubmitPress={() => {}} />,
      ),
    );
    const all = collectAllText(toJSON());
    expect(all.some((s) => /posted/.test(s))).toBe(false);
    expect(all.some((s) => /be the first/.test(s))).toBe(false);
    expect(all.some((s) => /pts/.test(s))).toBe(false);
  });

  it('appends a social fragment to the composite a11y label', () => {
    const { UNSAFE_root } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="none"
          onSubmitPress={() => {}}
          social={{ posted: 4, total: 6, points: 11, streak: 3 }}
        />,
      ),
    );
    // Outer card has accessibilityRole='summary'; we can find by that.
    const outer = UNSAFE_root.findByProps({ accessibilityRole: 'summary' });
    const label = (outer.props as { accessibilityLabel?: string })
      .accessibilityLabel;
    expect(label).toMatch(/4 of 6 posted today/);
    expect(label).toMatch(/11 points/);
    expect(label).toMatch(/3-day streak/);
  });
});
