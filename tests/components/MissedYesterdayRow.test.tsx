// MissedYesterdayRow — quiet tombstone row.
// UI-SPEC §"Component Additions §4" lines 598-630.
// HIGH #5 (REVIEWS replan 2026-05-08): backgroundColor MUST be a valid hsla(...)
// string produced by applyAlpha — NOT `t.colors.surfaceMuted + '66'`.

import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';

type TestRendererJSON = {
  type: string;
  props: Record<string, unknown>;
  children: Array<TestRendererJSON | string> | null;
};
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import {
  MissedYesterdayRow,
  type MissedMember,
} from '../../src/components/feed/MissedYesterdayRow';

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

const sam: MissedMember = { userId: 'u-sam', displayName: 'Sam Patel' };
const riley: MissedMember = { userId: 'u-rl', displayName: 'Riley Tan' };

describe('MissedYesterdayRow', () => {
  it('returns null when members is empty', () => {
    const { toJSON } = render(
      withTheme(<MissedYesterdayRow members={[]} tzShortLabel="PT" />),
    );
    expect(toJSON()).toBeNull();
  });

  it('renders all member display names', () => {
    const { getByText } = render(
      withTheme(
        <MissedYesterdayRow members={[sam, riley]} tzShortLabel="PT" />,
      ),
    );
    expect(getByText('Sam Patel')).toBeTruthy();
    expect(getByText('Riley Tan')).toBeTruthy();
  });

  it('renders the trailing tz copy with the provided tzShortLabel', () => {
    const { getByText } = render(
      withTheme(
        <MissedYesterdayRow members={[sam]} tzShortLabel="ET" />,
      ),
    );
    expect(getByText(/Streaks reset at 12:00 AM ET\.?/)).toBeTruthy();
  });

  it('composes a single screen-reader sentence as accessibilityLabel', () => {
    const { UNSAFE_root } = render(
      withTheme(
        <MissedYesterdayRow members={[sam, riley]} tzShortLabel="PT" />,
      ),
    );
    // The outer container has the composite a11y label.
    const json = UNSAFE_root.findByProps({
      accessibilityRole: 'text',
    }).props as { accessibilityLabel?: string };
    expect(json.accessibilityLabel).toMatch(/Sam Patel/);
    expect(json.accessibilityLabel).toMatch(/Riley Tan/);
    expect(json.accessibilityLabel).toMatch(/PT/);
  });

  // HIGH #5 (REVIEWS replan 2026-05-08): the container backgroundColor MUST be
  // a valid hsla(...) string — produced by applyAlpha — NOT the broken
  // `surfaceMuted + '66'` concat that yields `hsl(...)66`.
  it('container backgroundColor is a valid hsla(...) string (HIGH #5 fix)', () => {
    const { toJSON } = render(
      withTheme(<MissedYesterdayRow members={[sam]} tzShortLabel="PT" />),
    );
    // Outer is the accessibilityRole=text wrapper; the inner container holds
    // the muted backdrop. We collect every node's style and assert at least
    // one has a backgroundColor starting with `hsla(`.
    const tree = toJSON() as TestRendererJSON | null;
    expect(tree).not.toBeNull();
    const collected: string[] = [];
    function walk(node: TestRendererJSON | string | null): void {
      if (!node || typeof node === 'string') return;
      const style = (node.props as { style?: unknown }).style;
      const styles = Array.isArray(style) ? style : style ? [style] : [];
      for (const s of styles) {
        if (s && typeof s === 'object') {
          const bg = (s as { backgroundColor?: string }).backgroundColor;
          if (typeof bg === 'string') collected.push(bg);
        }
      }
      const children = node.children;
      if (Array.isArray(children)) {
        for (const c of children) walk(c as TestRendererJSON | string | null);
      }
    }
    walk(tree);
    const hasHsla = collected.some((c) => /^hsla\(/.test(c));
    expect(hasHsla).toBe(true);
  });
});
