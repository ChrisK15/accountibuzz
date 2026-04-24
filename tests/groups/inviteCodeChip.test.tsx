import type { ReactElement } from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { InviteCodeChip } from '../../src/components/InviteCodeChip';

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

describe('InviteCodeChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the raw 8-char code chunked as XXXX-XXXX', () => {
    const { getByText } = render(withTheme(<InviteCodeChip code="ABCDEF23" />));
    expect(getByText('ABCD-EF23')).toBeTruthy();
  });

  it('calls Clipboard.setStringAsync with the RAW 8-char (not the dashed form) on Copy tap', async () => {
    const { getByText } = render(withTheme(<InviteCodeChip code="ABCDEF23" />));
    await act(async () => {
      fireEvent.press(getByText('Copy'));
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABCDEF23');
  });

  it('fires Haptics.notificationAsync with Success on Copy tap', async () => {
    const { getByText } = render(withTheme(<InviteCodeChip code="ABCDEF23" />));
    await act(async () => {
      fireEvent.press(getByText('Copy'));
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('swaps the Copy label to "Copied ✓" for 2s then reverts', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, queryByText } = render(
        withTheme(<InviteCodeChip code="ABCDEF23" />),
      );
      await act(async () => {
        fireEvent.press(getByText('Copy'));
      });
      // Immediately after press, label should have swapped
      expect(getByText('Copied ✓')).toBeTruthy();
      expect(queryByText('Copy')).toBeNull();
      // After 2 seconds, revert to Copy
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(getByText('Copy')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('provides a letter-by-letter accessibilityLabel on the chip', () => {
    const { getByLabelText } = render(withTheme(<InviteCodeChip code="ABCDEF23" />));
    expect(
      getByLabelText('Invite code: A, B, C, D, dash, E, F, 2, 3'),
    ).toBeTruthy();
  });
});
