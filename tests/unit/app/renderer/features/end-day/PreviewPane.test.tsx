// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
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
        onCancel={vi.fn()}
        onRun={vi.fn()}
      />,
    );
    expect(getAllByText('Nothing to show.')).toHaveLength(2);
  });

  it('shows the mode badge ("Lean"/"Deep") alongside the state badge', () => {
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
        onCancel={vi.fn()}
        onRun={vi.fn()}
      />,
    );
    expect(getByText('alive')).not.toBeNull();
    expect(getByText('Deep')).not.toBeNull();
  });

  it('shows the cost ceiling text', () => {
    const { getByText } = render(
      <PreviewPane
        data={{ willBeCaptured: [], notCaptured: [], costCeiling: CEILING }}
        starting={false}
        onCancel={vi.fn()}
        onRun={vi.fn()}
      />,
    );
    expect(getByText(/up to 2 × \$0.50 per session/)).not.toBeNull();
  });

  it('starting=true hides Cancel and shows Run end-day now loading/disabled', () => {
    const { queryByRole, getByRole } = render(
      <PreviewPane
        data={{ willBeCaptured: [], notCaptured: [], costCeiling: CEILING }}
        starting={true}
        onCancel={vi.fn()}
        onRun={vi.fn()}
      />,
    );
    expect(queryByRole('button', { name: 'Cancel' })).toBeNull();
    const runButton = getByRole('button', { name: 'Run end-day now' }) as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);
  });

  it('clicking Run end-day now when not starting calls onRun', () => {
    const onRun = vi.fn();
    const { getByRole } = render(
      <PreviewPane
        data={{ willBeCaptured: [], notCaptured: [], costCeiling: CEILING }}
        starting={false}
        onCancel={vi.fn()}
        onRun={onRun}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Run end-day now' }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('a "closed" not-captured row shows the Closed badge, never Skipped/Failed', () => {
    const { getByText } = render(
      <PreviewPane
        data={{
          willBeCaptured: [],
          notCaptured: [
            { sessionId: 's1', name: 'gamma', cwd: '~/gamma', kind: 'closed', reason: 'x' },
          ],
          costCeiling: CEILING,
        }}
        starting={false}
        onCancel={vi.fn()}
        onRun={vi.fn()}
      />,
    );
    expect(getByText('Closed')).not.toBeNull();
  });
});
