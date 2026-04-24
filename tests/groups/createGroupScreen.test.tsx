// Create-group screen — integration tests.
// Spec: 02-UI-SPEC.md §"Create group" (lines 363-376); 02-05-PLAN.md §Task 2 behavior.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import type { ReactElement, ReactNode } from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';

// Hook module mock (must be declared BEFORE requiring the screen module).
const mockMutateAsync = jest.fn();
jest.mock('../../src/features/groups/useCreateGroup', () => ({
  useCreateGroup: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// Stub the timezone picker so it doesn't mount a modal (picker has its own tests).
// We expose a set of captured props so tests can simulate onSelect callbacks.
const pickerProps: Array<{
  visible: boolean;
  initialValue?: string;
  onSelect: (iana: string) => void;
  onDismiss: () => void;
}> = [];
jest.mock('../../src/features/groups/IanaTimezonePicker', () => ({
  IanaTimezonePicker: (props: {
    visible: boolean;
    initialValue?: string;
    onSelect: (iana: string) => void;
    onDismiss: () => void;
  }) => {
    pickerProps.push(props);
    return null;
  },
}));

// expo-router: useRouter returns jest.fns. Names must start with `mock` per jest's
// hoist guard for factory references.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NewGroupScreen = require('../../app/(app)/groups/new').default;

const theme: Theme = {
  colors: colors.light,
  spacing,
  radii,
  fonts,
  name: 'light',
};

function withProviders(node: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ThemeContext.Provider value={theme}>
        {node as ReactNode}
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockBack.mockReset();
  pickerProps.length = 0;
});

describe('NewGroupScreen (create-group form)', () => {
  it('renders the 4 form surfaces with the submit button disabled initially', () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      withProviders(<NewGroupScreen />),
    );
    // name + goal inputs visible
    expect(getByPlaceholderText('Morning runners')).toBeTruthy();
    expect(
      getByPlaceholderText('Post a photo of your run before 9am.'),
    ).toBeTruthy();
    // segmented control (Photo | Video)
    expect(getByText('Photo')).toBeTruthy();
    expect(getByText('Video')).toBeTruthy();
    // timezone readonly row
    expect(getByRole('button', { name: 'Pick a timezone' })).toBeTruthy();
    // submit button — disabled until RHF validates (name empty, goal too short)
    const submit = getByRole('button', { name: 'Create group' });
    expect(submit.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('enables the submit button after name + valid goal are entered', async () => {
    const { getByPlaceholderText, getByRole } = render(
      withProviders(<NewGroupScreen />),
    );
    const nameInput = getByPlaceholderText('Morning runners');
    const goalInput = getByPlaceholderText(
      'Post a photo of your run before 9am.',
    );
    await act(async () => {
      fireEvent.changeText(nameInput, 'Morning runners');
      fireEvent.changeText(goalInput, 'Run before 9am');
      fireEvent(nameInput, 'blur');
      fireEvent(goalInput, 'blur');
    });
    const submit = getByRole('button', { name: 'Create group' });
    await waitFor(() => {
      expect(submit.props.accessibilityState).toMatchObject({
        disabled: false,
      });
    });
  });

  it('calls useCreateGroup.mutateAsync with the 4-field payload and replaces to /groups/{id}', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      group_id: 'g-new',
      invite_code: 'ABCDEF23',
    });
    const { getByPlaceholderText, getByRole } = render(
      withProviders(<NewGroupScreen />),
    );
    const nameInput = getByPlaceholderText('Morning runners');
    const goalInput = getByPlaceholderText(
      'Post a photo of your run before 9am.',
    );
    await act(async () => {
      fireEvent.changeText(nameInput, 'Morning runners');
      fireEvent.changeText(goalInput, 'Run before 9am');
      fireEvent(nameInput, 'blur');
      fireEvent(goalInput, 'blur');
    });
    const submit = getByRole('button', { name: 'Create group' });
    await waitFor(() => {
      expect(submit.props.accessibilityState).toMatchObject({
        disabled: false,
      });
    });
    await act(async () => {
      fireEvent.press(submit);
    });
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    const call = mockMutateAsync.mock.calls[0][0];
    expect(call).toMatchObject({
      name: 'Morning runners',
      goal: 'Run before 9am',
      submission_type: 'photo',
    });
    expect(typeof call.timezone).toBe('string');
    expect(call.timezone.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/groups/g-new');
    });
  });

  it('surfaces the invalid_goal RPC error with UI-SPEC copy', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('invalid_goal'));
    const { getByPlaceholderText, getByRole, findByText } = render(
      withProviders(<NewGroupScreen />),
    );
    const nameInput = getByPlaceholderText('Morning runners');
    const goalInput = getByPlaceholderText(
      'Post a photo of your run before 9am.',
    );
    await act(async () => {
      fireEvent.changeText(nameInput, 'Morning runners');
      fireEvent.changeText(goalInput, 'Run before 9am');
      fireEvent(nameInput, 'blur');
      fireEvent(goalInput, 'blur');
    });
    const submit = getByRole('button', { name: 'Create group' });
    await waitFor(() => {
      expect(submit.props.accessibilityState).toMatchObject({
        disabled: false,
      });
    });
    await act(async () => {
      fireEvent.press(submit);
    });
    expect(
      await findByText('Add a bit more detail — at least 5 characters.'),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
