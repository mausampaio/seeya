// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { CwdChangeNotice } from '../../../../../../packages/app/src/renderer/features/today/CwdChangeNotice/index.js';
import type { CwdHistoryEntry } from '@seeya-ai/engine/application/cwd-history.js';

afterEach(cleanup);

const TWO_DIR_HISTORY: readonly CwdHistoryEntry[] = [
  { cwd: '/old', firstDay: '2026-08-14', lastDay: '2026-08-14', exists: false },
  { cwd: '/new', firstDay: '2026-08-16', lastDay: '2026-08-16', exists: true },
];

describe('CwdChangeNotice (D-052, V2-T66)', () => {
  it('shows the history note and the per-directory explanation', () => {
    const { getByText } = render(
      <CwdChangeNotice
        sessionId="s1"
        history={TWO_DIR_HISTORY}
        chosenCwd={undefined}
        disabled={false}
        onChooseCwd={() => {}}
      />,
    );
    expect(getByText(/in \/new since 2026-08-16/)).not.toBeNull();
    expect(getByText(/Claude Code keeps memory and project settings per directory/)).not.toBeNull();
  });

  it('offers the "Resume in" selector, defaulting to the most recent EXISTING directory', () => {
    const { getByLabelText } = render(
      <CwdChangeNotice
        sessionId="s1"
        history={TWO_DIR_HISTORY}
        chosenCwd={undefined}
        disabled={false}
        onChooseCwd={() => {}}
      />,
    );
    expect((getByLabelText('Resume in') as HTMLSelectElement).value).toBe('/new');
  });

  it('reflects an explicitly chosen directory, not the default, once one is chosen', () => {
    const olderStillExisting: readonly CwdHistoryEntry[] = [
      { cwd: '/first', firstDay: '2026-08-10', lastDay: '2026-08-12', exists: true },
      { cwd: '/second', firstDay: '2026-08-13', lastDay: '2026-08-15', exists: true },
    ];
    const { getByLabelText } = render(
      <CwdChangeNotice
        sessionId="s1"
        history={olderStillExisting}
        chosenCwd="/first"
        disabled={false}
        onChooseCwd={() => {}}
      />,
    );
    expect((getByLabelText('Resume in') as HTMLSelectElement).value).toBe('/first');
  });

  it('calls onChooseCwd with the sessionId and the newly picked value', () => {
    const olderStillExisting: readonly CwdHistoryEntry[] = [
      { cwd: '/first', firstDay: '2026-08-10', lastDay: '2026-08-12', exists: true },
      { cwd: '/second', firstDay: '2026-08-13', lastDay: '2026-08-15', exists: true },
    ];
    const onChooseCwd = vi.fn();
    const { getByLabelText } = render(
      <CwdChangeNotice
        sessionId="s1"
        history={olderStillExisting}
        chosenCwd={undefined}
        disabled={false}
        onChooseCwd={onChooseCwd}
      />,
    );
    fireEvent.change(getByLabelText('Resume in'), { target: { value: '/first' } });
    expect(onChooseCwd).toHaveBeenCalledWith('s1', '/first');
  });

  it('offers no selector at all when nothing in the history still exists', () => {
    const allGone: readonly CwdHistoryEntry[] = [
      { cwd: '/old', firstDay: '2026-08-14', lastDay: '2026-08-14', exists: false },
      { cwd: '/older', firstDay: '2026-08-10', lastDay: '2026-08-12', exists: false },
    ];
    const { queryByLabelText } = render(
      <CwdChangeNotice
        sessionId="s1"
        history={allGone}
        chosenCwd={undefined}
        disabled={false}
        onChooseCwd={() => {}}
      />,
    );
    expect(queryByLabelText('Resume in')).toBeNull();
  });

  it('disables the selector when asked', () => {
    const { getByLabelText } = render(
      <CwdChangeNotice
        sessionId="s1"
        history={TWO_DIR_HISTORY}
        chosenCwd={undefined}
        disabled
        onChooseCwd={() => {}}
      />,
    );
    expect((getByLabelText('Resume in') as HTMLSelectElement).disabled).toBe(true);
  });
});
