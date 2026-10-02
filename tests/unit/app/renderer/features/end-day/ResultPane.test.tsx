// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { ResultPane } from '../../../../../../packages/app/src/renderer/features/end-day/ResultPane/index.js';

afterEach(cleanup);

describe('ResultPane (D-052, V2-T69)', () => {
  it('shows the three headings with their counts, even when all are zero', () => {
    const { getByText } = render(<ResultPane captured={[]} failed={[]} skipped={[]} />);
    expect(getByText('Captured · 0')).not.toBeNull();
    expect(getByText('Failed · 0')).not.toBeNull();
    expect(getByText('Skipped · 0')).not.toBeNull();
  });

  // PO review round 1 (V2-T69, item 7): capitalized, matching the mode badge's own convention —
  // see `PreviewPane.test.tsx`'s own identical case for why.
  it('a captured row shows the state and mode badges, both capitalized', () => {
    const { getByText } = render(
      <ResultPane
        captured={[
          { sessionId: 's1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
        ]}
        failed={[]}
        skipped={[]}
      />,
    );
    expect(getByText('Ended')).not.toBeNull();
    expect(getByText('Lean')).not.toBeNull();
  });

  it('a failed row shows the raw reason, not just "failed"', () => {
    const { getByText } = render(
      <ResultPane
        captured={[]}
        failed={[
          {
            sessionId: 's2',
            name: 'beta',
            cwd: '~/beta',
            reason: 'claude binary not found',
            fullReason: 'claude binary not found',
          },
        ]}
        skipped={[]}
      />,
    );
    expect(getByText('claude binary not found')).not.toBeNull();
  });

  // PO review round 1 (V2-T69, item 5): the complete message is still reachable, as the row's own
  // `title` tooltip, never hidden outright.
  it('a failed row with a shortened reason carries the full message as a tooltip', () => {
    const { getByText } = render(
      <ResultPane
        captured={[]}
        failed={[
          {
            sessionId: 's2',
            name: 'beta',
            cwd: '~/beta',
            reason: '~/.seeya/days/x.json is not valid JSON…',
            fullReason: '/home/x/.seeya/days/x.json is not valid JSON: SyntaxError',
          },
        ]}
        skipped={[]}
      />,
    );
    const detail = getByText('~/.seeya/days/x.json is not valid JSON…');
    expect(detail.title).toBe('/home/x/.seeya/days/x.json is not valid JSON: SyntaxError');
  });

  it('a skipped row shows the ineligibility sentence', () => {
    const { getByText } = render(
      <ResultPane
        captured={[]}
        failed={[]}
        skipped={[
          {
            sessionId: 's3',
            name: 'gamma',
            cwd: '~/gamma',
            reason: 'Already captured today with unchanged evidence.',
            fullReason: 'Already captured today with unchanged evidence.',
          },
        ]}
      />,
    );
    expect(getByText('Already captured today with unchanged evidence.')).not.toBeNull();
  });

  // Open Today/Close moved to `EndDayDialog`'s own footer (PO review round 1, V2-T69 item 4) — the
  // click behaviour is covered by `EndDayDialog.test.tsx`'s own "result shows... and Open Today"
  // test, which renders through the real dialog instead of this pane in isolation.
});
