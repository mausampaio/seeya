// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { ResumeResult } from '../../../../../../packages/app/src/renderer/features/today/ResumeResult/index.js';
import type { ResumeSummaryResponse } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

// Every case below (except the dedicated "abbreviates and titles" one) uses a `cwd` outside this
// `homeDir`, so `formatDirectoryPathForDisplay` returns it unchanged — same visible text as
// before this round's fix, just wrapped in the `cwd`'s own nested `<span>` now (PO review of
// V2-T66, third round, item 2).
const HOME_DIR = '/home/<usuario>';
const PLATFORM_HINT = 'posix';

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

function renderResult(result: ResumeSummaryResponse) {
  return render(<ResumeResult result={result} homeDir={HOME_DIR} platformHint={PLATFORM_HINT} />);
}

/** The cwd now lives in its own nested `<span>` (for its own `title`), so the full line's text is
 * split across elements — `getByText` can't match that by default. Reading the `<li>`'s own
 * recursive `textContent` instead proves the same full line without caring how it's split. */
function lineTexts(container: Element): readonly string[] {
  return [...container.querySelectorAll('li')].map((li) => li.textContent ?? '');
}

describe('ResumeResult (D-052, V2-T66)', () => {
  it('renders no section heading when every list is empty', () => {
    const { queryByText } = renderResult(emptyResult());
    expect(queryByText('Resumed')).toBeNull();
    expect(queryByText('Skipped at your request')).toBeNull();
    expect(queryByText('Not resumed')).toBeNull();
  });

  it('renders a plain "name (cwd)" line for a resumed session with no note', () => {
    const result = emptyResult({
      resumed: [{ kind: 'resumed', sessionId: 's1', name: 'alpha', cwd: '/alpha' }],
    });
    const { getByText, container } = renderResult(result);
    expect(getByText('Resumed')).not.toBeNull();
    expect(lineTexts(container)).toEqual(['alpha (/alpha)']);
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
    const { container } = renderResult(result);
    expect(lineTexts(container)).toEqual([
      "alpha (/alpha) — Resumed without yesterday's plan — it was 50000 characters, over the " +
        '40000-character limit.',
    ]);
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
    const { container } = renderResult(result);
    expect(lineTexts(container)).toEqual([
      'alpha (/alpha) — Opened a new session there instead — the original transcript could ' +
        'not be resumed.',
    ]);
  });

  it('renders skipped sessions with their reason', () => {
    const result = emptyResult({
      skipped: [{ sessionId: 's1', name: 'alpha', cwd: '/alpha', reasonText: 'you chose to skip' }],
    });
    const { getByText, container } = renderResult(result);
    expect(getByText('Skipped at your request')).not.toBeNull();
    expect(lineTexts(container)).toEqual(['alpha (/alpha) — you chose to skip']);
  });

  it('renders invalid fallback answers with their reason', () => {
    const result = emptyResult({
      invalidFallbackAnswers: [
        { sessionId: 's1', name: 'alpha', cwd: '/alpha', reason: 'unrecognized answer "z"' },
      ],
    });
    const { getByText, container } = renderResult(result);
    expect(getByText('Not resumed — invalid fallback answer')).not.toBeNull();
    expect(lineTexts(container)).toEqual(['alpha (/alpha) — unrecognized answer "z"']);
  });

  it('renders remaining (not-yet-attempted) sessions with no note', () => {
    const result = emptyResult({
      remaining: [{ sessionId: 's1', name: 'alpha', cwd: '/alpha' }],
    });
    const { getByText, container } = renderResult(result);
    expect(getByText('Not resumed')).not.toBeNull();
    expect(lineTexts(container)).toEqual(['alpha (/alpha)']);
  });

  it('renders the stoppedEarly note when the loop stopped early', () => {
    const result = emptyResult({
      stoppedEarly: {
        session: { sessionId: 's1', name: 'alpha', cwd: '/alpha' },
        message: 'spawn failed',
      },
    });
    const { getByText } = renderResult(result);
    expect(getByText('Stopped after "alpha" failed: spawn failed')).not.toBeNull();
  });

  it('shows no stoppedEarly note when it is false', () => {
    const { queryByText } = renderResult(emptyResult());
    expect(queryByText(/Stopped after/)).toBeNull();
  });

  // PO review of V2-T66, third round, item 2: the raw, absolute `cwd` that still showed in the
  // "Resumed" block (today-resume-result-sync-dark.png) — now abbreviated/shortened like every
  // other `cwd` in the tab, with the full raw path kept in the `<span>`'s own `title`.
  it('abbreviates a cwd under the home directory, keeping the full path in title', () => {
    const result = emptyResult({
      resumed: [
        {
          kind: 'resumed',
          sessionId: 's1',
          name: 'payments-webhooks',
          cwd: '/home/<usuario>/code/payments',
        },
      ],
    });
    const { getByTitle, container } = renderResult(result);
    expect(lineTexts(container)).toEqual(['payments-webhooks (~/code/payments)']);
    expect(getByTitle('/home/<usuario>/code/payments')).not.toBeNull();
  });
});
