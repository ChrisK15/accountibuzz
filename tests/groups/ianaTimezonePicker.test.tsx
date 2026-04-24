// IanaTimezonePicker — integration tests.
// Spec: 02-UI-SPEC.md §"IanaTimezonePicker" (lines 378-379); 02-05-PLAN.md §Task 2 behavior.
//
// Mutates Intl.supportedValuesOf between tests (mirrors tests/intl-supportedvaluesof-probe.test.ts)
// to verify the listTimezones static-fallback path (Pitfall 4 defense).

import type { ReactElement } from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { IanaTimezonePicker } from '../../src/features/groups/IanaTimezonePicker';

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

const originalSupportedValuesOf = (
  Intl as unknown as { supportedValuesOf?: unknown }
).supportedValuesOf;

afterEach(() => {
  if (originalSupportedValuesOf === undefined) {
    delete (Intl as unknown as { supportedValuesOf?: unknown })
      .supportedValuesOf;
  } else {
    (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf =
      originalSupportedValuesOf;
  }
});

describe('IanaTimezonePicker', () => {
  it('renders a FlatList with ≥ 40 rows when visible (via listTimezones)', () => {
    const { UNSAFE_getByType } = render(
      withTheme(
        <IanaTimezonePicker
          visible
          onSelect={() => {}}
          onDismiss={() => {}}
        />,
      ),
    );
    // Lazy import to get the FlatList component class from react-native.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FlatList } = require('react-native');
    const list = UNSAFE_getByType(FlatList);
    expect(Array.isArray(list.props.data)).toBe(true);
    expect(list.props.data.length).toBeGreaterThanOrEqual(40);
  });

  it('filters the list by query substring matching iana or label', () => {
    const { UNSAFE_getByType, getByPlaceholderText } = render(
      withTheme(
        <IanaTimezonePicker
          visible
          onSelect={() => {}}
          onDismiss={() => {}}
        />,
      ),
    );
    const search = getByPlaceholderText('Search cities or regions');
    act(() => {
      fireEvent.changeText(search, 'Tokyo');
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FlatList } = require('react-native');
    const list = UNSAFE_getByType(FlatList);
    const data = list.props.data as Array<{ iana: string; label: string }>;
    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      const hay = (entry.iana + ' ' + entry.label).toLowerCase();
      expect(hay).toContain('tokyo');
    }
    // Sanity: Asia/Tokyo should be present in the filtered list.
    expect(data.some((e) => e.iana === 'Asia/Tokyo')).toBe(true);
  });

  it('calls onSelect with the exact IANA string when a row is pressed', () => {
    const onSelect = jest.fn();
    const { UNSAFE_getByType } = render(
      withTheme(
        <IanaTimezonePicker
          visible
          onSelect={onSelect}
          onDismiss={() => {}}
        />,
      ),
    );
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FlatList } = require('react-native');
    const list = UNSAFE_getByType(FlatList);
    const data = list.props.data as Array<{ iana: string; label: string }>;
    const target = data.find((e) => e.iana === 'Asia/Tokyo');
    expect(target).toBeDefined();
    // Invoke the renderItem → press directly rather than scrolling to it.
    const rendered = list.props.renderItem({ item: target, index: 0 });
    // renderItem returns a Pressable; simulate the press via its onPress prop.
    expect(rendered.props.onPress).toBeInstanceOf(Function);
    act(() => {
      rendered.props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('Asia/Tokyo');
  });

  it('renders ≥ 400 rows from STATIC_FALLBACK when Intl.supportedValuesOf is undefined (Pitfall 4 defense)', () => {
    delete (Intl as unknown as { supportedValuesOf?: unknown })
      .supportedValuesOf;
    const { UNSAFE_getByType } = render(
      withTheme(
        <IanaTimezonePicker
          visible
          onSelect={() => {}}
          onDismiss={() => {}}
        />,
      ),
    );
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FlatList } = require('react-native');
    const list = UNSAFE_getByType(FlatList);
    const data = list.props.data as Array<{ iana: string; label: string }>;
    expect(data.length).toBeGreaterThanOrEqual(400);
    expect(data.some((e) => e.iana === 'America/Los_Angeles')).toBe(true);
    expect(data.some((e) => e.iana === 'Europe/London')).toBe(true);
    expect(data.some((e) => e.iana === 'Asia/Tokyo')).toBe(true);
  });

  it('shows empty-state copy when no rows match the search', () => {
    const { getByPlaceholderText, getByText } = render(
      withTheme(
        <IanaTimezonePicker
          visible
          onSelect={() => {}}
          onDismiss={() => {}}
        />,
      ),
    );
    const search = getByPlaceholderText('Search cities or regions');
    act(() => {
      fireEvent.changeText(search, 'zzzzzzz-no-match');
    });
    expect(
      getByText('No match. Try another city or region.'),
    ).toBeTruthy();
  });
});
