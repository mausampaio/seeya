import { describe, expect, it } from 'vitest';
import { buildSidebarRows } from '../../../../packages/app/src/sidebar/sidebar-data.js';
import {
  addTab,
  createTab,
  emptyTabs,
  withPid,
} from '../../../../packages/app/src/tabs/tab-model.js';
import { createConfig } from '../../core/_fixtures.js';
import { createSessionWithPid, createSessionWithoutPid } from '../../core/_fixtures.js';
import { FakeClock, FakeSessionProvider } from '../../application/_fakes.js';

const NOW = new Date('2026-08-29T12:00:00.000Z');

describe('buildSidebarRows', () => {
  it('every discovered session gets a row, matched to its open tab by pid when one exists', async () => {
    const matched = createSessionWithPid({
      pid: 555,
      sessionId: '11111111-1111-4111-8111-111111111111',
      name: 'matched-session',
    });
    const unmatched = createSessionWithPid({
      pid: 777,
      sessionId: '22222222-2222-4222-8222-222222222222',
      name: 'unmatched-session',
    });
    const tab = withPid(createTab({ id: 'tab-1', command: '', args: [], cwd: '/x' }), 555);
    const tabs = addTab(emptyTabs(), tab);

    const rows = await buildSidebarRows(
      new FakeSessionProvider({ sessions: [matched, unmatched], rejected: [] }),
      createConfig(),
      new FakeClock(NOW),
      tabs,
    );

    const byName = new Map(rows.map((row) => [row.name, row]));
    expect(byName.get('matched-session')?.matchedTabId).toBe('tab-1');
    expect(byName.get('unmatched-session')?.matchedTabId).toBeNull();
  });

  it('a session without a pid is listed with no match (D-025), never guessed', async () => {
    const session = createSessionWithoutPid({ name: 'no-pid-session' });

    const rows = await buildSidebarRows(
      new FakeSessionProvider({ sessions: [session], rejected: [] }),
      createConfig(),
      new FakeClock(NOW),
      emptyTabs(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.matchedTabId).toBeNull();
  });

  it('an empty discovery produces an empty sidebar, not an error', async () => {
    const rows = await buildSidebarRows(
      new FakeSessionProvider({ sessions: [], rejected: [] }),
      createConfig(),
      new FakeClock(NOW),
      emptyTabs(),
    );

    expect(rows).toEqual([]);
  });
});
