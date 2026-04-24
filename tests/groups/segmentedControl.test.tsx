import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { SegmentedControl } from '../../src/components/SegmentedControl';

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

describe('SegmentedControl', () => {
  const options = [
    { value: 'photo', label: 'Photo' },
    { value: 'video', label: 'Video' },
  ];

  it('renders both option labels', () => {
    const { getByText } = render(
      withTheme(
        <SegmentedControl options={options} value="photo" onChange={() => {}} />,
      ),
    );
    expect(getByText('Photo')).toBeTruthy();
    expect(getByText('Video')).toBeTruthy();
  });

  it('marks the active segment selected and inactive one not-selected', () => {
    const { getByRole } = render(
      withTheme(
        <SegmentedControl options={options} value="photo" onChange={() => {}} />,
      ),
    );
    const buttons = getByRole('button', { name: 'Photo' });
    expect(buttons.props.accessibilityState).toMatchObject({ selected: true });
    const inactive = getByRole('button', { name: 'Video' });
    expect(inactive.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('calls onChange with the new value when an inactive segment is pressed', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      withTheme(
        <SegmentedControl options={options} value="photo" onChange={onChange} />,
      ),
    );
    fireEvent.press(getByText('Video'));
    expect(onChange).toHaveBeenCalledWith('video');
  });

  it('does not fire onChange when disabled', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      withTheme(
        <SegmentedControl
          options={options}
          value="photo"
          onChange={onChange}
          disabled
        />,
      ),
    );
    fireEvent.press(getByText('Video'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
