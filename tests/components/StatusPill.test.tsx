// StatusPill state coverage — verifies all 4 visual states and a11y role
// branching (button only when status==='rejected' AND onPress provided).
// Spec: 03-04-PLAN Task 2 acceptance criteria.

import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { StatusPill } from '../../src/components/StatusPill';

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

describe('StatusPill', () => {
  it('none state renders em-dash with a11y label "No submission yet"', () => {
    const { getByText, getByLabelText } = render(
      withTheme(<StatusPill status="none" />),
    );
    expect(getByText('—')).toBeTruthy();
    expect(getByLabelText('No submission yet')).toBeTruthy();
  });

  it('pending state renders "Pending review" with a11y label', () => {
    const { getByText, getByLabelText } = render(
      withTheme(<StatusPill status="pending" />),
    );
    expect(getByText('Pending review')).toBeTruthy();
    expect(getByLabelText('Pending review')).toBeTruthy();
  });

  it('approved state renders "Approved"', () => {
    const { getByText } = render(withTheme(<StatusPill status="approved" />));
    expect(getByText('Approved')).toBeTruthy();
  });

  it('rejected state with onPress is a button and fires onPress on tap', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      withTheme(<StatusPill status="rejected" onPress={onPress} />),
    );
    const pill = getByRole('button', { name: /Today didn't count/ });
    fireEvent.press(pill);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('rejected state without onPress is a non-pressable text element', () => {
    const { queryByRole, getByText } = render(
      withTheme(<StatusPill status="rejected" />),
    );
    expect(queryByRole('button')).toBeNull();
    expect(getByText("Today didn't count")).toBeTruthy();
  });
});
