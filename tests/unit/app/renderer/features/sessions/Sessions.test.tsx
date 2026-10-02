// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { Sessions } from '../../../../../../packages/app/src/renderer/features/sessions/Sessions.js';
import type { ProjectPanelOtherSessionRow } from '../../../../../../packages/app/src/state/projects-panel.js';
import type { ProjectsPanelData } from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

function otherSession(
  overrides: Partial<ProjectPanelOtherSessionRow> = {},
): ProjectPanelOtherSessionRow {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    displaySessionId: '1111',
    name: 'Payments investigation',
    cwd: '/repo/payments',
    state: 'unknown',
    stateLabel: 'no running process',
    lastActivity: null,
    matchedTabId: null,
    adopt: { kind: 'available' },
    ...overrides,
  };
}

function panelWithOtherSessions(
  sessions: readonly ProjectPanelOtherSessionRow[],
): ProjectsPanelData {
  return {
    projects: [],
    otherSessionsByDirectory:
      sessions.length === 0
        ? []
        : [{ dir: sessions[0]!.cwd, sessionCount: sessions.length, sessions }],
    ignoredProjects: [],
  };
}

describe('Sessions (V2-T68)', () => {
  it('no session discovered at all shows the empty state', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() => Promise.resolve(panelWithOtherSessions([]))),
    });
    const { getByText } = render(<Sessions />);
    await waitFor(() => expect(getByText('No sessions yet')).not.toBeNull());
  });

  it('with sessions: shows the header counts and the table', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(
          panelWithOtherSessions([
            otherSession({ sessionId: 'a', name: 'Alpha' }),
            otherSession({ sessionId: 'b', name: 'Beta' }),
          ]),
        ),
      ),
    });
    const { getByText } = render(<Sessions />);
    await waitFor(() => expect(getByText('2 sessions')).not.toBeNull());
    expect(getByText('Alpha')).not.toBeNull();
    expect(getByText('Beta')).not.toBeNull();
  });

  it('a name search with no match shows the no-match empty state', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ name: 'Alpha' })])),
      ),
    });
    const { getByLabelText, getByText } = render(<Sessions />);
    await waitFor(() => expect(getByText('Alpha')).not.toBeNull());
    fireEvent.input(getByLabelText('Search by name or id'), {
      target: { value: 'zzz-nothing-like-this' },
    });
    await waitFor(() => expect(getByText('No sessions match')).not.toBeNull());
  });

  it('a found direct-id hit renders in the same table, outside the loaded list', async () => {
    const found: ProjectPanelOtherSessionRow = otherSession({
      sessionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      displaySessionId: 'ffff',
      name: 'Old session outside the window',
    });
    const findSessionById = vi.fn(() =>
      Promise.resolve({ kind: 'found' as const, session: found }),
    );
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'aaaa' })])),
      ),
      findSessionById,
    });
    const { getByLabelText, findByText } = render(<Sessions />);
    await findByText('Payments investigation'); // the first panel has settled
    fireEvent.input(getByLabelText('Search by name or id'), { target: { value: 'ffff' } });
    expect(await findByText('Old session outside the window')).not.toBeNull();
    expect(findSessionById).toHaveBeenCalledWith({ idOrPrefix: 'ffff' });
  });

  it('an ambiguous direct-id hit shows the count message and every candidate', async () => {
    const candidates: ProjectPanelOtherSessionRow[] = [
      otherSession({ sessionId: 'abcd1111', displaySessionId: 'abcd1111', name: 'One' }),
      otherSession({ sessionId: 'abcd2222', displaySessionId: 'abcd2222', name: 'Two' }),
    ];
    const findSessionById = vi.fn(() =>
      Promise.resolve({ kind: 'ambiguous' as const, candidates }),
    );
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'aaaa' })])),
      ),
      findSessionById,
    });
    const { getByLabelText, findByText } = render(<Sessions />);
    await findByText('Payments investigation');
    fireEvent.input(getByLabelText('Search by name or id'), { target: { value: 'abcd' } });
    expect(
      await findByText('"abcd" matches 2 sessions — type a few more characters.'),
    ).not.toBeNull();
    expect(await findByText('One')).not.toBeNull();
    expect(await findByText('Two')).not.toBeNull();
  });

  it('a direct-id hit that matches nothing shows the "not found" empty state with the query', async () => {
    const findSessionById = vi.fn(() => Promise.resolve({ kind: 'notFound' as const }));
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'aaaa' })])),
      ),
      findSessionById,
    });
    const { getByLabelText, findByText } = render(<Sessions />);
    await findByText('Payments investigation');
    fireEvent.input(getByLabelText('Search by name or id'), { target: { value: 'ffff' } });
    expect(await findByText('No session matches "ffff".')).not.toBeNull();
  });
});
