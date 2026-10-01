// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { Today } from '../../../../../../packages/app/src/renderer/features/today/index.js';
import type { TodayPanelData } from '../../../../../../packages/app/src/state/today-panel.js';
import type { ResumeSummaryResponse } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

const PENDING_DATA: TodayPanelData = {
  kind: 'pending',
  day: '2026-09-30',
  // `daysAgo: 1` is `MESSAGES.todayPlanTitle`'s own unremarkable case (Q-026, the morning after)
  // — the plain "Plan for <day>" title, with no "(N days ago)" suffix.
  daysAgo: 1,
  capturedAt: new Date('2026-09-30T21:00:00.000Z'),
  rows: [
    {
      sessionId: 'a',
      displaySessionId: 'a',
      name: 'payments-webhooks',
      cwd: '/code/payments',
      firstPlanLine: 'Finish the retry queue',
      resumeStatus: { kind: 'neverResumed' },
      cwdHistory: [],
    },
    {
      sessionId: 'b',
      displaySessionId: 'b',
      name: 'auth-hardening',
      cwd: '/code/auth',
      firstPlanLine: null,
      resumeStatus: { kind: 'runningNow', matchedTabId: null },
      cwdHistory: [],
    },
  ],
};

describe('Today (D-052, V2-T66)', () => {
  it('shows the empty state when there is no pending briefing', async () => {
    window.seeya = createFakeSeeyaApi({
      getTodayPanel: () =>
        Promise.resolve({ kind: 'noBriefing', message: 'Nothing captured yet.' }),
    });
    const { getByText } = render(<Today />);
    await waitFor(() => expect(getByText('Nothing captured yet.')).not.toBeNull());
  });

  it('shows the plan header and one card per session, in each of its two states', async () => {
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(PENDING_DATA) });
    const { getByText, getByRole } = render(<Today />);

    await waitFor(() => expect(getByText('Plan for 2026-09-30')).not.toBeNull());
    expect(getByText('payments-webhooks')).not.toBeNull();
    expect(getByText('auth-hardening')).not.toBeNull();
    expect(getByText('Running now · open in a tab')).not.toBeNull();
    expect(getByRole('checkbox')).not.toBeNull();
  });

  it('the footer disables Resume selected with a reason when nothing is checked', async () => {
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(PENDING_DATA) });
    const { getByRole, getByText } = render(<Today />);

    await waitFor(() =>
      expect((getByRole('button', { name: 'Resume selected' }) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );
    expect(getByText('Select at least one session to resume.')).not.toBeNull();
  });

  it('checking a session enables Resume selected and updates the count', async () => {
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(PENDING_DATA) });
    const { getByRole, getByText } = render(<Today />);
    await waitFor(() => expect(getByRole('checkbox')).not.toBeNull());

    fireEvent.click(getByRole('checkbox'));

    expect(getByText('1 selected')).not.toBeNull();
    expect((getByRole('button', { name: 'Resume selected' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('Resume selected shows the running reason when every row is already runningNow', async () => {
    const allRunning: TodayPanelData = {
      ...PENDING_DATA,
      rows: PENDING_DATA.rows.filter((row) => row.resumeStatus.kind === 'runningNow'),
    };
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(allRunning) });
    const { getByText } = render(<Today />);

    await waitFor(() =>
      expect(
        getByText("All of today's planned sessions are already open — nothing to resume."),
      ).not.toBeNull(),
    );
  });

  it('clicking Resume selected calls the IPC, shows the loading state, then the result', async () => {
    let resolveResume: ((response: ResumeSummaryResponse) => void) | undefined;
    const resumeSelected = vi.fn(
      () =>
        new Promise<ResumeSummaryResponse>((resolve) => {
          resolveResume = resolve;
        }),
    );
    window.seeya = createFakeSeeyaApi({
      getTodayPanel: vi
        .fn()
        .mockResolvedValueOnce(PENDING_DATA)
        .mockResolvedValueOnce(PENDING_DATA),
      resumeSelected,
    });
    const { getByRole, getByText } = render(<Today />);
    await waitFor(() => expect(getByRole('checkbox')).not.toBeNull());
    fireEvent.click(getByRole('checkbox'));

    fireEvent.click(getByRole('button', { name: 'Resume selected' }));
    expect(resumeSelected).toHaveBeenCalledWith({
      day: '2026-09-30',
      sessionIds: ['a'],
      chosenCwdBySessionId: {},
    });
    expect(
      (getByRole('button', { name: 'Resume selected' }) as HTMLButtonElement).getAttribute(
        'aria-busy',
      ),
    ).toBe('true');

    await act(async () => {
      resolveResume?.({
        resumed: [
          { kind: 'resumed', sessionId: 'a', name: 'payments-webhooks', cwd: '/code/payments' },
        ],
        skipped: [],
        invalidFallbackAnswers: [],
        remaining: [],
        stoppedEarly: false,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(getByText('Resumed')).not.toBeNull());
    expect(getByText('payments-webhooks (/code/payments)')).not.toBeNull();
  });

  it('shows resume progress while a resumeSelected call is in flight', async () => {
    let pushProgress: ((event: { index: number; total: number; name: string }) => void) | undefined;
    const resumeSelected = vi.fn(() => new Promise<ResumeSummaryResponse>(() => {}));
    window.seeya = createFakeSeeyaApi({
      getTodayPanel: () => Promise.resolve(PENDING_DATA),
      resumeSelected,
      onResumeProgress: (listener) => {
        pushProgress = listener;
      },
    });
    const { getByRole, getByText } = render(<Today />);
    await waitFor(() => expect(getByRole('checkbox')).not.toBeNull());
    fireEvent.click(getByRole('checkbox'));
    fireEvent.click(getByRole('button', { name: 'Resume selected' }));

    void act(() => pushProgress?.({ index: 1, total: 1, name: 'payments-webhooks' }));

    expect(getByText('Resuming 1 of 1: payments-webhooks...')).not.toBeNull();
  });

  it('Clear selection empties the checked set', async () => {
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(PENDING_DATA) });
    const { getByRole, getByText } = render(<Today />);
    await waitFor(() => expect(getByRole('checkbox')).not.toBeNull());
    fireEvent.click(getByRole('checkbox'));
    expect(getByText('1 selected')).not.toBeNull();

    fireEvent.click(getByRole('button', { name: 'Clear selection' }));
    expect(getByText('0 selected')).not.toBeNull();
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});
