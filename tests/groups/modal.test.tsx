import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { Modal } from '../../src/components/Modal';

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

function basicProps(overrides?: Partial<React.ComponentProps<typeof Modal>>) {
  return {
    visible: true,
    onDismiss: jest.fn(),
    title: 'Delete this group?',
    body: <Text>Everyone loses access.</Text>,
    primaryAction: {
      label: 'Delete group',
      onPress: jest.fn(),
      variant: 'destructive' as const,
    },
    cancelLabel: 'Keep the group',
    ...overrides,
  };
}

describe('Modal', () => {
  it('renders title, body, primary action label, secondary action label, and cancelLabel', () => {
    const props = basicProps({
      secondaryAction: {
        label: 'Delete the group',
        onPress: jest.fn(),
        variant: 'destructive-text',
      },
    });
    const { getByText } = render(withTheme(<Modal {...props} />));
    expect(getByText('Delete this group?')).toBeTruthy();
    expect(getByText('Everyone loses access.')).toBeTruthy();
    expect(getByText('Delete group')).toBeTruthy();
    expect(getByText('Delete the group')).toBeTruthy();
    expect(getByText('Keep the group')).toBeTruthy();
  });

  it('calls primaryAction.onPress when primary button is tapped', () => {
    const props = basicProps();
    const { getByText } = render(withTheme(<Modal {...props} />));
    fireEvent.press(getByText('Delete group'));
    expect(props.primaryAction.onPress).toHaveBeenCalled();
  });

  it('calls onDismiss when the scrim is tapped', () => {
    const props = basicProps();
    const { getByTestId } = render(withTheme(<Modal {...props} />));
    fireEvent.press(getByTestId('modal-scrim'));
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when the dismiss button is tapped', () => {
    const props = basicProps();
    const { getByText } = render(withTheme(<Modal {...props} />));
    fireEvent.press(getByText('Keep the group'));
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it("dev-warns when cancelLabel is 'Cancel' (case-insensitive)", () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(withTheme(<Modal {...basicProps({ cancelLabel: 'Cancel' })} />));
      render(withTheme(<Modal {...basicProps({ cancelLabel: 'cancel' })} />));
      render(withTheme(<Modal {...basicProps({ cancelLabel: 'CANCEL' })} />));
      expect(warn).toHaveBeenCalled();
      const calls = warn.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(calls).toMatch(/Modal/);
      expect(calls).toMatch(/cancelLabel/);
      warn.mockClear();

      render(withTheme(<Modal {...basicProps({ cancelLabel: 'Keep the group' })} />));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
