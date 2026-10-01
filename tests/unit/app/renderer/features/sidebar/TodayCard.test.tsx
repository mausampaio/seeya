// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { TodayCard } from '../../../../../../packages/app/src/renderer/features/sidebar/TodayCard/index.js';

afterEach(cleanup);

describe('TodayCard (D-052, V2-T75)', () => {
  it('shows "Nothing to resume" with no pill when there is no briefing', () => {
    const { getByText, queryByText } = render(
      <TodayCard summary={{ kind: 'noBriefing' }} active={false} onClick={() => {}} />,
    );
    expect(getByText('Nothing to resume')).not.toBeNull();
    expect(queryByText(/^\d+ to resume$/)).toBeNull();
  });

  it('shows the day label and the resume-count pill when there is something to resume', () => {
    const { getByText } = render(
      <TodayCard
        summary={{ kind: 'pending', dayLabel: 'today', resumableCount: 2 }}
        active={false}
        onClick={() => {}}
      />,
    );
    expect(getByText('Plan for today')).not.toBeNull();
    expect(getByText('2 to resume')).not.toBeNull();
  });

  it('shows no pill when nothing is resumable, even with a pending briefing', () => {
    const { queryByText } = render(
      <TodayCard
        summary={{ kind: 'pending', dayLabel: 'today', resumableCount: 0 }}
        active={false}
        onClick={() => {}}
      />,
    );
    expect(queryByText(/^\d+ to resume$/)).toBeNull();
  });

  it('reflects the active state via aria-current', () => {
    const { getByRole } = render(
      <TodayCard summary={{ kind: 'noBriefing' }} active onClick={() => {}} />,
    );
    expect(getByRole('button').getAttribute('aria-current')).toBe('true');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <TodayCard summary={{ kind: 'noBriefing' }} active={false} onClick={onClick} />,
    );
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
