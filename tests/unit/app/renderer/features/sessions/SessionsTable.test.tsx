// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SessionsTable } from '../../../../../../packages/app/src/renderer/features/sessions/SessionsTable/index.js';
import { COLUMNS } from '../../../../../../packages/app/src/renderer/features/sessions/SessionsTable/SessionsTable.js';
import type { SessionsPanelRow } from '../../../../../../packages/app/src/state/sessions-panel.js';

afterEach(cleanup);

function row(overrides: Partial<SessionsPanelRow> = {}): SessionsPanelRow {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    displaySessionId: '1111',
    name: 'Payments investigation',
    cwd: '/repo/payments',
    state: 'unknown',
    stateLabel: 'no running process',
    lastActivity: null,
    matchedTabId: null,
    projectId: null,
    projectName: null,
    adopt: { kind: 'available' },
    ...overrides,
  };
}

const BASE_PROPS = {
  homeDir: '',
  platformHint: 'posix' as const,
  isResumePending: () => false,
  onRowAction: () => {},
  onAdopt: () => {},
};

describe('SessionsTable (V2-T68)', () => {
  it('renders the headers and one row per session', () => {
    const { getByText } = render(
      <SessionsTable
        {...BASE_PROPS}
        rows={[row({ sessionId: 'a', name: 'Alpha' }), row({ sessionId: 'b', name: 'Beta' })]}
      />,
    );
    expect(getByText('Name')).not.toBeNull();
    expect(getByText('State')).not.toBeNull();
    expect(getByText('Alpha')).not.toBeNull();
    expect(getByText('Beta')).not.toBeNull();
  });

  it('a session open in a tab shows "Go to tab" and calls onRowAction when clicked', () => {
    const onRowAction = vi.fn();
    const r = row({ matchedTabId: 'tab-1' });
    const { getByText } = render(
      <SessionsTable {...BASE_PROPS} rows={[r]} onRowAction={onRowAction} />,
    );
    fireEvent.click(getByText('Go to tab'));
    expect(onRowAction).toHaveBeenCalledWith(r);
  });

  it('a running session with no tab here shows no action at all', () => {
    const r = row({ state: 'idle' });
    const { queryByText } = render(<SessionsTable {...BASE_PROPS} rows={[r]} />);
    expect(queryByText('Go to tab')).toBeNull();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('Adopt…')).toBeNull();
  });

  it('a session with a project and no process shows an empty action cell', () => {
    const r = row({ state: 'ended', projectId: 'p', projectName: 'Auth hardening', adopt: null });
    const { getByText, queryByText } = render(<SessionsTable {...BASE_PROPS} rows={[r]} />);
    expect(getByText('Auth hardening')).not.toBeNull();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('Adopt…')).toBeNull();
  });

  it('a session with no project and no process shows "No project" and both Resume and Adopt…', () => {
    const onRowAction = vi.fn();
    const onAdopt = vi.fn();
    const r = row();
    const { getByText } = render(
      <SessionsTable {...BASE_PROPS} rows={[r]} onRowAction={onRowAction} onAdopt={onAdopt} />,
    );
    expect(getByText('No project')).not.toBeNull();
    fireEvent.click(getByText('Resume'));
    expect(onRowAction).toHaveBeenCalledWith(r);
    fireEvent.click(getByText('Adopt…'));
    expect(onAdopt).toHaveBeenCalledWith(r);
  });

  it('Resume shows loading while pending, never Adopt…', () => {
    const r = row();
    const { getByText } = render(
      <SessionsTable {...BASE_PROPS} rows={[r]} isResumePending={() => true} />,
    );
    expect(getByText('Resume').closest('button')?.getAttribute('aria-busy')).toBe('true');
    expect(getByText('Adopt…').closest('button')?.getAttribute('aria-busy')).toBeNull();
  });

  it('Adopt… is disabled with the reason as a dica when ineligible', () => {
    const r = row({ adopt: { kind: 'unavailable', reason: 'already adopted into project "x"' } });
    const { getByText, queryByText } = render(<SessionsTable {...BASE_PROPS} rows={[r]} />);
    const button = getByText('Adopt…').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('already adopted into project "x"');
    // PO review round 1 (regression): the reason is a `title` tooltip ONLY, never a visible line
    // of text in the row — `disabledReason` used to render a sibling `<p>`, doubling the row's
    // height and pushing `lastActivity` out of its own column.
    expect(queryByText('already adopted into project "x"')).toBeNull();
  });

  describe('copying the short id', () => {
    const writeText = vi.fn(() => Promise.resolve());

    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      writeText.mockClear();
    });

    it('copies the short id and shows a visible "Copied!" confirmation', async () => {
      const r = row({ displaySessionId: 'abcd1234' });
      const { getByText, findByText } = render(<SessionsTable {...BASE_PROPS} rows={[r]} />);
      fireEvent.click(getByText('abcd1234'));
      expect(writeText).toHaveBeenCalledWith('abcd1234');
      expect(await findByText('Copied!')).not.toBeNull();
    });
  });

  // V2-T81 PO review: the old rule (every column but Name fixed, sum capped at 850px) starved the
  // text columns at 1500px. New rule (`SessionsTable.tsx`'s own `COLUMNS` docstring): Id, State,
  // Last activity and the action column are FIXED at a width that fits their whole content; Name,
  // Directory and Project are FLEXIBLE (no width) and share what is left. happy-dom never runs a
  // layout engine, so the real-pixel proof is the `getBoundingClientRect()` read against the built
  // bundle; this guard locks the numbers that rule rests on.
  describe('column width rule (regression guard)', () => {
    const widthOf = (key: string): number =>
      Number(COLUMNS.find((column) => column.key === key)?.width?.replace('px', '') ?? Number.NaN);

    it('Name, Directory and Project are flexible: no explicit width', () => {
      for (const key of ['name', 'directory', 'project']) {
        expect(COLUMNS.find((column) => column.key === key)?.width, key).toBeUndefined();
      }
    });

    it('keeps the columns, in order', () => {
      expect(COLUMNS.map((column) => column.key)).toEqual([
        'name',
        'id',
        'state',
        'directory',
        'project',
        'lastActivity',
        'action',
      ]);
    });

    it('the fixed columns are at least as wide as their whole content (never truncate)', () => {
      expect(widthOf('id')).toBeGreaterThanOrEqual(100); // 8 mono characters + cell padding
      expect(widthOf('state')).toBeGreaterThanOrEqual(160); // "no running process"
      expect(widthOf('lastActivity')).toBeGreaterThanOrEqual(174); // "02/10/2026, 00:16:44"
      expect(widthOf('action')).toBeGreaterThanOrEqual(200); // Resume + Adopt…
    });

    it('the fixed widths leave room for the flexible columns (sum stays under 660px)', () => {
      const fixedKeys = ['id', 'state', 'lastActivity', 'action'];
      const total = fixedKeys.reduce((sum, key) => sum + widthOf(key), 0);
      expect(total).toBeLessThanOrEqual(660);
    });
  });
});
