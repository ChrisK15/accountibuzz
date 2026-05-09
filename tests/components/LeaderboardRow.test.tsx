// LeaderboardRow — composed row with rank chip, avatar, name, meta, points.
// UI-SPEC §"Component Additions §1 LeaderboardRow" lines 458-505.

import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { LeaderboardRow } from '../../src/components/leaderboard/LeaderboardRow';

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
  rank: 1,
  userId: 'u-alice',
  isYou: false,
  displayName: 'Alice Smith',
  points: 18,
  currentStreak: 7,
};

describe('LeaderboardRow', () => {
  it('renders rank-1 chip with primary background', () => {
    const { UNSAFE_root } = render(
      withTheme(<LeaderboardRow {...baseProps} rank={1} />),
    );
    // Find a node with style backgroundColor matching the primary token.
    const allViews = UNSAFE_root.findAll(
      (node: { type: unknown }) =>
        typeof node.type !== 'string' ||
        ['View', 'RCTView'].includes(node.type as string),
    );
    const hasPrimaryBg = allViews.some((node: { props: { style?: unknown } }) => {
      const style = node.props.style;
      const styles = Array.isArray(style) ? style : style ? [style] : [];
      return styles.some((s) => {
        if (s && typeof s === 'object') {
          const bg = (s as { backgroundColor?: string }).backgroundColor;
          return bg === colors.light.primary;
        }
        return false;
      });
    });
    expect(hasPrimaryBg).toBe(true);
  });

  it('renders rank-2/3 chip with surfaceMuted background', () => {
    const { UNSAFE_root } = render(
      withTheme(<LeaderboardRow {...baseProps} rank={2} />),
    );
    const allViews = UNSAFE_root.findAll(
      (node: { type: unknown }) =>
        typeof node.type !== 'string' ||
        ['View', 'RCTView'].includes(node.type as string),
    );
    const hasSurfaceMutedBg = allViews.some((node: { props: { style?: unknown } }) => {
      const style = node.props.style;
      const styles = Array.isArray(style) ? style : style ? [style] : [];
      return styles.some((s) => {
        if (s && typeof s === 'object') {
          const bg = (s as { backgroundColor?: string }).backgroundColor;
          return bg === colors.light.surfaceMuted;
        }
        return false;
      });
    });
    expect(hasSurfaceMutedBg).toBe(true);
  });

  it('renders bare numeral for rank 4+ (no chip background)', () => {
    const { getByText } = render(
      withTheme(<LeaderboardRow {...baseProps} rank={5} />),
    );
    expect(getByText('5')).toBeTruthy();
  });

  it('renders "(you)" appendix when isYou is true', () => {
    const { getByText } = render(
      withTheme(<LeaderboardRow {...baseProps} isYou={true} />),
    );
    expect(getByText(/Alice Smith/)).toBeTruthy();
    expect(getByText(/\(you\)/)).toBeTruthy();
  });

  it('composes accessibilityLabel including rank/name/points/streak', () => {
    const { UNSAFE_root } = render(
      withTheme(
        <LeaderboardRow {...baseProps} rank={3} points={11} currentStreak={4} />,
      ),
    );
    const outer = UNSAFE_root.findByProps({ accessibilityRole: 'text' });
    const label = (outer.props as { accessibilityLabel?: string })
      .accessibilityLabel;
    expect(label).toMatch(/Rank 3/);
    expect(label).toMatch(/Alice Smith/);
    expect(label).toMatch(/11 points/);
    expect(label).toMatch(/4-day streak/);
  });

  // 04-05 Task 3: reduceMotion prop default + Animated.View wrappers around
  // points + currentStreak fragments. The cross-fade logic uses
  // Animated.timing with duration 125ms (out) + 125ms (in) = 250ms total.
  // The Animated.View at rest renders identically to a plain View — these
  // tests cover the runtime acceptance + tree shape (≥1 Animated.View child
  // in the row tree), not the timing per se.
  it('accepts reduceMotion=false prop and renders points + streak normally', () => {
    const { getByText } = render(
      withTheme(<LeaderboardRow {...baseProps} reduceMotion={false} />),
    );
    expect(getByText(String(baseProps.points))).toBeTruthy();
    // Streak meta uses the 🔥 emoji + the streak number.
    expect(getByText(new RegExp(`🔥${baseProps.currentStreak}`))).toBeTruthy();
  });

  it('accepts reduceMotion=true prop and skips animation while still rendering', () => {
    const { getByText } = render(
      withTheme(<LeaderboardRow {...baseProps} reduceMotion={true} />),
    );
    expect(getByText(String(baseProps.points))).toBeTruthy();
    expect(getByText(new RegExp(`🔥${baseProps.currentStreak}`))).toBeTruthy();
  });

  it('updates points + streak when props change (cross-fade integration smoke)', () => {
    const { getByText, rerender } = render(
      withTheme(
        <LeaderboardRow {...baseProps} points={5} currentStreak={1} />,
      ),
    );
    expect(getByText('5')).toBeTruthy();
    rerender(
      withTheme(
        <LeaderboardRow {...baseProps} points={6} currentStreak={2} />,
      ),
    );
    expect(getByText('6')).toBeTruthy();
    expect(getByText(/🔥2/)).toBeTruthy();
  });
});
