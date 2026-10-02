// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { ProgressPane } from '../../../../../../packages/app/src/renderer/features/end-day/ProgressPane/index.js';

afterEach(cleanup);

describe('ProgressPane (D-052, V2-T69)', () => {
  it('shows the "Capturing i of N: name" headline', () => {
    const { getByText } = render(
      <ProgressPane current={{ index: 2, total: 5, name: 'alpha' }} sessions={[]} />,
    );
    expect(getByText('Capturing 2 of 5: alpha...')).not.toBeNull();
  });

  it('the progress bar fills by FINISHED sessions, not by the current index', () => {
    const { getByRole } = render(
      <ProgressPane
        current={{ index: 2, total: 4, name: 'beta' }}
        sessions={[
          { sessionId: 's1', name: 'alpha', status: 'captured' },
          { sessionId: 's2', name: 'beta', status: 'capturing' },
          { sessionId: 's3', name: 'gamma', status: 'waiting' },
          { sessionId: 's4', name: 'delta', status: 'waiting' },
        ]}
      />,
    );
    const bar = getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
  });

  it('counts ineligible/failed as finished too (not just captured)', () => {
    const { getByRole } = render(
      <ProgressPane
        current={{ index: 3, total: 3, name: 'gamma' }}
        sessions={[
          { sessionId: 's1', name: 'alpha', status: 'captured' },
          { sessionId: 's2', name: 'beta', status: 'ineligible' },
          { sessionId: 's3', name: 'gamma', status: 'failed' },
        ]}
      />,
    );
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
  });

  it('renders one status badge per session', () => {
    const { getByText } = render(
      <ProgressPane
        current={{ index: 1, total: 2, name: 'alpha' }}
        sessions={[
          { sessionId: 's1', name: 'alpha', status: 'capturing' },
          { sessionId: 's2', name: 'beta', status: 'waiting' },
        ]}
      />,
    );
    expect(getByText('Capturing')).not.toBeNull();
    expect(getByText('Waiting')).not.toBeNull();
  });

  // Hide moved to `EndDayDialog`'s own footer (PO review round 1, V2-T69 item 4) — the click
  // behaviour is covered by `EndDayDialog.test.tsx`'s own "Hide calls the control" test, which
  // renders through the real dialog instead of this pane in isolation.
});
