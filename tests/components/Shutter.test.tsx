// Shutter variant + onPress coverage — behavior-preservation safety net for the
// 03.1-03 visual rewrite (D-08..D-10). The rewrite changes ONLY the inner-fill
// geometry; the public API (variant union + onPress + accessibility labels)
// must remain identical. This test file LOCKS that contract.
//
// Spec: 03.1-03-PLAN.md Task 1.

import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { Shutter } from '../../src/components/Shutter';

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

describe('Shutter', () => {
  it('photo variant renders with "Take photo" accessibility label', () => {
    const { getByLabelText } = render(
      withTheme(<Shutter variant="photo" onPress={() => {}} />),
    );
    expect(getByLabelText('Take photo')).toBeTruthy();
  });

  it('video-idle variant renders with "Start recording" accessibility label', () => {
    const { getByLabelText } = render(
      withTheme(<Shutter variant="video-idle" onPress={() => {}} />),
    );
    expect(getByLabelText('Start recording')).toBeTruthy();
  });

  it('video-recording variant renders with "Stop recording" accessibility label', () => {
    const { getByLabelText } = render(
      withTheme(<Shutter variant="video-recording" onPress={() => {}} />),
    );
    expect(getByLabelText('Stop recording')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      withTheme(<Shutter variant="photo" onPress={onPress} />),
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
