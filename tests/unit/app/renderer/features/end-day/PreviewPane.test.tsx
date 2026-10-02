// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { PreviewPane } from '../../../../../../packages/app/src/renderer/features/end-day/PreviewPane/index.js';

afterEach(cleanup);

const CEILING = {
  sessionsInScope: 2,
  budgetPerSessionUsd: 0.5,
  captureModel: 'sonnet',
  totalCeilingUsd: 1,
};

describe('PreviewPane (D-052, V2-T69)', () => {
  it('shows the empty message for both lists when nothing is in either bucket', () => {
    const { getAllByText } = render(
      <PreviewPane
        data={{ willBeCaptured: [], notCaptured: [], costCeiling: CEILING }}
        starting={false}
      />,
    );
    expect(getAllByText('Nothing to show.')).toHaveLength(2);
  });

  // PO review round 1 (V2-T69, item 7): the state badge now reads capitalized ("Alive"), matching
  // the mode badge's own convention ("Deep") — `formatSessionStateLabel`'s own canonical, lowercase
  // return value is unchanged (every OTHER caller still needs it lowercase); only this row's own
  // display copy capitalizes it (`session-badges.ts#buildSessionSummaryBadges`).
  it('shows the mode badge ("Lean"/"Deep") alongside the state badge, both capitalized', () => {
    const { getByText } = render(
      <PreviewPane
        data={{
          willBeCaptured: [
            { sessionId: 's1', name: 'alpha', cwd: '~/alpha', state: 'alive', mode: 'deep' },
          ],
          notCaptured: [],
          costCeiling: CEILING,
        }}
        starting={false}
      />,
    );
    expect(getByText('Alive')).not.toBeNull();
    expect(getByText('Deep')).not.toBeNull();
  });

  it('shows the cost ceiling text', () => {
    const { getByText } = render(
      <PreviewPane
        data={{ willBeCaptured: [], notCaptured: [], costCeiling: CEILING }}
        starting={false}
      />,
    );
    expect(getByText(/up to 2 × \$0.50 per session/)).not.toBeNull();
  });

  it('a "closed" not-captured row shows the Closed badge, never Skipped/Failed', () => {
    const { getByText } = render(
      <PreviewPane
        data={{
          willBeCaptured: [],
          notCaptured: [
            {
              sessionId: 's1',
              name: 'gamma',
              cwd: '~/gamma',
              kind: 'closed',
              reason: 'x',
              fullReason: 'x',
            },
          ],
          costCeiling: CEILING,
        }}
        starting={false}
      />,
    );
    expect(getByText('Closed')).not.toBeNull();
  });

  // PO review round 1 (V2-T69, item 5): the row's visible text is the short `reason`; the complete
  // message only shows up as a hover tooltip (`title`), never hidden outright.
  it('a failed row shows the short reason, with the full one only in the tooltip', () => {
    const { getByText } = render(
      <PreviewPane
        data={{
          willBeCaptured: [],
          notCaptured: [
            {
              sessionId: 's1',
              name: 'zeta',
              cwd: '~/zeta',
              kind: 'failed',
              reason: '~/.seeya/days/x.json is not valid JSON…',
              fullReason:
                '/home/x/.seeya/days/x.json is not valid JSON: SyntaxError: Unexpected token',
            },
          ],
          costCeiling: CEILING,
        }}
        starting={false}
      />,
    );
    const detail = getByText('~/.seeya/days/x.json is not valid JSON…');
    expect(detail.title).toBe(
      '/home/x/.seeya/days/x.json is not valid JSON: SyntaxError: Unexpected token',
    );
  });

  it('a reason that was not shortened carries no tooltip at all', () => {
    const { getByText } = render(
      <PreviewPane
        data={{
          willBeCaptured: [],
          notCaptured: [
            {
              sessionId: 's1',
              name: 'beta',
              cwd: '~/beta',
              kind: 'ineligible',
              reason: 'This directory is in the ignore list.',
              fullReason: 'This directory is in the ignore list.',
            },
          ],
          costCeiling: CEILING,
        }}
        starting={false}
      />,
    );
    const detail = getByText('This directory is in the ignore list.');
    expect(detail.title).toBe('');
  });
});
