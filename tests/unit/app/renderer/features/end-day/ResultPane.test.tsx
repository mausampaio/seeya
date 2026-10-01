// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ResultPane } from '../../../../../../packages/app/src/renderer/features/end-day/ResultPane/index.js';

afterEach(cleanup);

describe('ResultPane (D-052, V2-T69)', () => {
  it('shows the three headings with their counts, even when all are zero', () => {
    const { getByText } = render(
      <ResultPane captured={[]} failed={[]} skipped={[]} onOpenToday={vi.fn()} onClose={vi.fn()} />,
    );
    expect(getByText('Captured · 0')).not.toBeNull();
    expect(getByText('Failed · 0')).not.toBeNull();
    expect(getByText('Skipped · 0')).not.toBeNull();
  });

  it('a captured row shows the state and mode badges', () => {
    const { getByText } = render(
      <ResultPane
        captured={[
          { sessionId: 's1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
        ]}
        failed={[]}
        skipped={[]}
        onOpenToday={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByText('ended')).not.toBeNull();
    expect(getByText('Lean')).not.toBeNull();
  });

  it('a failed row shows the raw reason, not just "failed"', () => {
    const { getByText } = render(
      <ResultPane
        captured={[]}
        failed={[
          { sessionId: 's2', name: 'beta', cwd: '~/beta', reason: 'claude binary not found' },
        ]}
        skipped={[]}
        onOpenToday={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByText('claude binary not found')).not.toBeNull();
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
          },
        ]}
        onOpenToday={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByText('Already captured today with unchanged evidence.')).not.toBeNull();
  });

  it('Open Today and Close call their own controls', () => {
    const onOpenToday = vi.fn();
    const onClose = vi.fn();
    const { getByRole } = render(
      <ResultPane
        captured={[]}
        failed={[]}
        skipped={[]}
        onOpenToday={onOpenToday}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Open Today' }));
    fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(onOpenToday).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
