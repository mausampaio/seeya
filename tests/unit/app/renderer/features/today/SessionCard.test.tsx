// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SessionCard } from '../../../../../../packages/app/src/renderer/features/today/SessionCard/index.js';
import type { TodaySessionRow } from '../../../../../../packages/app/src/state/today-panel.js';

afterEach(cleanup);

function row(overrides: Partial<TodaySessionRow> = {}): TodaySessionRow {
  return {
    sessionId: 'session-1',
    displaySessionId: 'session-',
    name: 'payments-webhooks',
    cwd: '/code/payments',
    firstPlanLine: 'Finish the retry queue',
    resumeStatus: { kind: 'neverResumed' },
    cwdHistory: [],
    ...overrides,
  };
}

describe('SessionCard (D-052, V2-T66) — neverResumed', () => {
  it('shows name, short id, directory, and the first plan line', () => {
    const { getByText } = render(
      <SessionCard
        row={row()}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect(getByText('payments-webhooks')).not.toBeNull();
    expect(getByText('session-')).not.toBeNull();
    expect(getByText('/code/payments')).not.toBeNull();
    expect(getByText('Finish the retry queue')).not.toBeNull();
  });

  it('shows the no-plan-recorded fallback when firstPlanLine is null (D-025)', () => {
    const { getByText } = render(
      <SessionCard
        row={row({ firstPlanLine: null })}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect(getByText('no plan recorded')).not.toBeNull();
  });

  it('offers a checkbox, unchecked by default, with no status chip', () => {
    const { getByRole, queryByText } = render(
      <SessionCard
        row={row()}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(queryByText('Resumed earlier · closed')).toBeNull();
    expect(queryByText('Running now · open in a tab')).toBeNull();
  });

  it('calls onToggle with the sessionId when the checkbox is clicked', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(
      <SessionCard
        row={row()}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={onToggle}
        onChooseCwd={() => {}}
      />,
    );
    fireEvent.click(getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('session-1', true);
  });

  it('clicking anywhere on the card toggles the checkbox (whole content is the label)', () => {
    const onToggle = vi.fn();
    const { getByText } = render(
      <SessionCard
        row={row()}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={onToggle}
        onChooseCwd={() => {}}
      />,
    );
    fireEvent.click(getByText('Finish the retry queue'));
    expect(onToggle).toHaveBeenCalledWith('session-1', true);
  });

  it('disables the checkbox while resuming', () => {
    const { getByRole } = render(
      <SessionCard
        row={row()}
        checked={false}
        disabled
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect((getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows the directory-change notice only when the history has more than one entry', () => {
    const withHistory = row({
      cwdHistory: [
        { cwd: '/old', firstDay: '2026-08-14', lastDay: '2026-08-14', exists: false },
        { cwd: '/code/payments', firstDay: '2026-08-16', lastDay: '2026-08-16', exists: true },
      ],
    });
    const { getByText } = render(
      <SessionCard
        row={withHistory}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect(getByText(/Claude Code keeps memory/)).not.toBeNull();
  });

  it('shows no directory-change notice with a single-entry history', () => {
    const { queryByText } = render(
      <SessionCard
        row={row({
          cwdHistory: [
            { cwd: '/code/payments', firstDay: '2026-08-16', lastDay: '2026-08-16', exists: true },
          ],
        })}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect(queryByText(/Claude Code keeps memory/)).toBeNull();
  });
});

describe('SessionCard — resumedEarlier', () => {
  it('still offers a checkbox, with the "Resumed earlier · closed" chip', () => {
    const { getByRole, getByText } = render(
      <SessionCard
        row={row({ resumeStatus: { kind: 'resumedEarlier' } })}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect(getByRole('checkbox')).not.toBeNull();
    expect(getByText('Resumed earlier · closed')).not.toBeNull();
  });
});

describe('SessionCard — runningNow', () => {
  it('offers no checkbox, with the "Running now · open in a tab" chip', () => {
    const { queryByRole, getByText } = render(
      <SessionCard
        row={row({ resumeStatus: { kind: 'runningNow', matchedTabId: null } })}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect(queryByRole('checkbox')).toBeNull();
    expect(getByText('Running now · open in a tab')).not.toBeNull();
  });

  it('still shows the name/id/directory/plan line', () => {
    const { getByText } = render(
      <SessionCard
        row={row({ resumeStatus: { kind: 'runningNow', matchedTabId: 'tab-1' } })}
        checked={false}
        disabled={false}
        chosenCwd={undefined}
        onToggle={() => {}}
        onChooseCwd={() => {}}
      />,
    );
    expect(getByText('payments-webhooks')).not.toBeNull();
    expect(getByText('/code/payments')).not.toBeNull();
  });
});
