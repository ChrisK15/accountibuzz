// StillToPostAvatarRow — comma-list bucketing + +N overflow + cutoff inline.
// UI-SPEC §"Component Additions §3 StillToPostAvatarRow" lines 557-596.

import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import {
  StillToPostAvatarRow,
  type StillToPostMember,
} from '../../src/components/feed/StillToPostAvatarRow';

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

const sam: StillToPostMember = { userId: 'u-sam', displayName: 'Sam Patel' };
const riley: StillToPostMember = { userId: 'u-rl', displayName: 'Riley Tan' };
const tomas: StillToPostMember = { userId: 'u-tm', displayName: 'Tomás Ruiz' };
const jordan: StillToPostMember = {
  userId: 'u-jo',
  displayName: 'Jordan Kim',
};
const morgan: StillToPostMember = {
  userId: 'u-mo',
  displayName: 'Morgan Lee',
};
const taylor: StillToPostMember = {
  userId: 'u-ta',
  displayName: 'Taylor Cruz',
};

describe('StillToPostAvatarRow', () => {
  it('returns null when members is empty', () => {
    const { toJSON } = render(
      withTheme(<StillToPostAvatarRow members={[]} />),
    );
    expect(toJSON()).toBeNull();
  });

  it('renders single first name when one member', () => {
    const { getByText } = render(
      withTheme(<StillToPostAvatarRow members={[sam]} />),
    );
    expect(getByText('Sam')).toBeTruthy();
  });

  it('renders 2-3 first names with middot separators', () => {
    const { getByText } = render(
      withTheme(
        <StillToPostAvatarRow members={[sam, riley, tomas]} />,
      ),
    );
    expect(getByText(/Sam.*·.*Riley.*·.*Tomás/)).toBeTruthy();
  });

  it('renders first 2 first names + "{N} more" when 4+ members', () => {
    const { getByText } = render(
      withTheme(
        <StillToPostAvatarRow
          members={[sam, riley, tomas, jordan, morgan]}
        />,
      ),
    );
    // 5 missers → "Sam · Riley · 3 more"
    expect(getByText(/Sam.*·.*Riley.*·.*3 more/)).toBeTruthy();
  });

  it('renders cutoff inline when cutoffLabel provided', () => {
    const { getByText } = render(
      withTheme(
        <StillToPostAvatarRow members={[sam]} cutoffLabel="9:00 PM" />,
      ),
    );
    expect(getByText(/9:00 PM cutoff/)).toBeTruthy();
  });

  it('renders +N overflow chip when members exceed maxVisible', () => {
    const { toJSON } = render(
      withTheme(
        <StillToPostAvatarRow
          members={[sam, riley, tomas, jordan, morgan, taylor]}
        />,
      ),
    );
    // 6 members with default maxVisible=5 → +1 chip. The avatar overlap
    // block is `accessibilityElementsHidden`; testing-library's `getByText`
    // and `queryAllByText` filter such subtrees out. Walk the JSON tree
    // directly to find the chip Text node.
    let foundPlusOne = false;
    function walk(node: unknown): void {
      if (!node || typeof node === 'string') {
        if (typeof node === 'string' && node === '+1') foundPlusOne = true;
        return;
      }
      const obj = node as { children?: unknown };
      if (Array.isArray(obj.children)) {
        for (const c of obj.children) walk(c);
      }
    }
    walk(toJSON());
    expect(foundPlusOne).toBe(true);
  });
});
