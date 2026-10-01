// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { ResumeResult } from '../../../../../../packages/app/src/renderer/features/today/ResumeResult/index.js';
import type { ResumeSummaryResponse } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

function emptyResult(overrides: Partial<ResumeSummaryResponse> = {}): ResumeSummaryResponse {
  return {
    resumed: [],
    skipped: [],
    invalidFallbackAnswers: [],
    remaining: [],
    stoppedEarly: false,
    ...overrides,
  };
}

describe('ResumeResult (D-052, V2-T66)', () => {
  it('renders no section heading when every list is empty', () => {
    const { queryByText } = render(<ResumeResult result={emptyResult()} />);
    expect(queryByText('Resumed')).toBeNull();
    expect(queryByText('Skipped at your request')).toBeNull();
    expect(queryByText('Not resumed')).toBeNull();
  });

  it('renders a plain "name (cwd)" line for a resumed session with no note', () => {
    const result = emptyResult({
      resumed: [{ kind: 'resumed', sessionId: 's1', name: 'alpha', cwd: '/alpha' }],
    });
    const { getByText } = render(<ResumeResult result={result} />);
    expect(getByText('Resumed')).not.toBeNull();
    expect(getByText('alpha (/alpha)')).not.toBeNull();
  });

  it('appends the resumedWithoutPlan note', () => {
    const result = emptyResult({
      resumed: [
        {
          kind: 'resumedWithoutPlan',
          sessionId: 's1',
          name: 'alpha',
          cwd: '/alpha',
          noteText: 'it was 50000 characters, over the 40000-character limit',
        },
      ],
    });
    const { getByText } = render(<ResumeResult result={result} />);
    expect(
      getByText(
        "alpha (/alpha) — Resumed without yesterday's plan — it was 50000 characters, over the " +
          '40000-character limit.',
      ),
    ).not.toBeNull();
  });

  it('appends the freshSession fallback note', () => {
    const result = emptyResult({
      resumed: [
        {
          kind: 'freshSession',
          sessionId: 's1',
          name: 'alpha',
          cwd: '/alpha',
          noteText: 'the original transcript could not be resumed',
        },
      ],
    });
    const { getByText } = render(<ResumeResult result={result} />);
    expect(
      getByText(
        'alpha (/alpha) — Opened a new session there instead — the original transcript could ' +
          'not be resumed.',
      ),
    ).not.toBeNull();
  });

  it('renders skipped sessions with their reason', () => {
    const result = emptyResult({
      skipped: [{ sessionId: 's1', name: 'alpha', cwd: '/alpha', reasonText: 'you chose to skip' }],
    });
    const { getByText } = render(<ResumeResult result={result} />);
    expect(getByText('Skipped at your request')).not.toBeNull();
    expect(getByText('alpha (/alpha) — you chose to skip')).not.toBeNull();
  });

  it('renders invalid fallback answers with their reason', () => {
    const result = emptyResult({
      invalidFallbackAnswers: [
        { sessionId: 's1', name: 'alpha', cwd: '/alpha', reason: 'unrecognized answer "z"' },
      ],
    });
    const { getByText } = render(<ResumeResult result={result} />);
    expect(getByText('Not resumed — invalid fallback answer')).not.toBeNull();
    expect(getByText('alpha (/alpha) — unrecognized answer "z"')).not.toBeNull();
  });

  it('renders remaining (not-yet-attempted) sessions with no note', () => {
    const result = emptyResult({
      remaining: [{ sessionId: 's1', name: 'alpha', cwd: '/alpha' }],
    });
    const { getByText } = render(<ResumeResult result={result} />);
    expect(getByText('Not resumed')).not.toBeNull();
    expect(getByText('alpha (/alpha)')).not.toBeNull();
  });

  it('renders the stoppedEarly note when the loop stopped early', () => {
    const result = emptyResult({
      stoppedEarly: {
        session: { sessionId: 's1', name: 'alpha', cwd: '/alpha' },
        message: 'spawn failed',
      },
    });
    const { getByText } = render(<ResumeResult result={result} />);
    expect(getByText('Stopped after "alpha" failed: spawn failed')).not.toBeNull();
  });

  it('shows no stoppedEarly note when it is false', () => {
    const { queryByText } = render(<ResumeResult result={emptyResult()} />);
    expect(queryByText(/Stopped after/)).toBeNull();
  });
});
