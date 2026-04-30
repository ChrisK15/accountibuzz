// GroupCard state-matrix coverage — verifies status × queuedUploadSize × kind
// → CTA branching per UI-SPEC §State Matrix (lines 982-993).

import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeContext, type Theme } from '../../src/theme/useTheme';
import { colors, spacing, radii, fonts } from '../../src/theme/tokens';
import { GroupCard } from '../../src/components/GroupCard';

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
  groupId: 'g-1',
  name: 'Morning runners',
  goal: 'Daily run photo',
  kind: 'photo' as const,
  status: 'none' as const,
  cutoffTime: '12:00 AM',
  minutesLeft: 240,
};

describe('GroupCard state matrix', () => {
  beforeEach(() => jest.clearAllMocks());

  it('status=none + photo → "Submit photo" CTA fires onSubmitPress', () => {
    const onSubmitPress = jest.fn();
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="none"
          kind="photo"
          onSubmitPress={onSubmitPress}
        />,
      ),
    );
    const cta = getByText('Submit photo');
    expect(cta).toBeTruthy();
    fireEvent.press(cta);
    expect(onSubmitPress).toHaveBeenCalledTimes(1);
  });

  it('status=none + video → "Submit video" CTA', () => {
    const { getByText } = render(
      withTheme(
        <GroupCard {...baseProps} kind="video" onSubmitPress={() => {}} />,
      ),
    );
    expect(getByText('Submit video')).toBeTruthy();
  });

  it('status=pending → "Submitted" disabled CTA + "Pending review" pill', () => {
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="pending"
          submittedAgo="2m ago"
          onSubmitPress={() => {}}
        />,
      ),
    );
    expect(getByText('Submitted')).toBeTruthy();
    expect(getByText('Pending review')).toBeTruthy();
  });

  it('status=approved → "Submitted" disabled CTA + "Approved" pill', () => {
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="approved"
          submittedAgo="1h ago"
          onSubmitPress={() => {}}
        />,
      ),
    );
    expect(getByText('Submitted')).toBeTruthy();
    expect(getByText('Approved')).toBeTruthy();
  });

  it("status=rejected → \"Today didn't count\" CTA renders + rejected pill is tappable when reason+handler provided", () => {
    const onRejectedPillPress = jest.fn();
    const { getAllByText, getByRole } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="rejected"
          rejectionReason="not today's run"
          onRejectedPillPress={onRejectedPillPress}
          onSubmitPress={() => {}}
        />,
      ),
    );
    // Both the disabled CTA and the interactive pill carry the same text.
    const matches = getAllByText("Today didn't count");
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Two role=button elements carry the "Today didn't count" text — the disabled
    // GhostButton CTA and the interactive StatusPill. The pill's a11y label
    // includes "Tap to see admin's note", which uniquely identifies it.
    const pill = getByRole('button', { name: /Tap to see admin's note/ });
    fireEvent.press(pill);
    expect(onRejectedPillPress).toHaveBeenCalledTimes(1);
  });

  it('queuedUploadSize provided → inline QueueBadge renders with size text', () => {
    const onQueueBadgeMorePress = jest.fn();
    const { getByText } = render(
      withTheme(
        <GroupCard
          {...baseProps}
          status="pending"
          submittedAgo="2m ago"
          queuedUploadSize="2.4 MB"
          onQueueBadgeMorePress={onQueueBadgeMorePress}
          onSubmitPress={() => {}}
        />,
      ),
    );
    expect(getByText(/Upload pending — 2\.4 MB queued/)).toBeTruthy();
  });

  it('queuedUploadSize undefined → QueueBadge NOT rendered', () => {
    const { queryByText } = render(
      withTheme(
        <GroupCard {...baseProps} status="none" onSubmitPress={() => {}} />,
      ),
    );
    expect(queryByText(/Upload pending/)).toBeNull();
  });
});
