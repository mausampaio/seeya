import { describe, expect, it } from 'vitest';
import {
  buildLiveSessionIndex,
  buildSidebarRows,
} from '../../../../packages/app/src/sidebar/sidebar-data.js';
import {
  addTab,
  createTab,
  emptyTabs,
  withPid,
} from '../../../../packages/app/src/tabs/tab-model.js';
import { createConfig } from '../../core/_fixtures.js';
import { createSessionWithPid, createSessionWithoutPid } from '../../core/_fixtures.js';

const NOW = new Date('2026-08-29T12:00:00.000Z');

describe('buildSidebarRows', () => {
  it('every discovered session gets a row, matched to its open tab by pid when one exists', () => {
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

    const rows = buildSidebarRows(
      { sessions: [matched, unmatched], rejected: [] },
      createConfig(),
      NOW,
      tabs,
    );

    const byName = new Map(rows.map((row) => [row.name, row]));
    expect(byName.get('matched-session')?.matchedTabId).toBe('tab-1');
    expect(byName.get('unmatched-session')?.matchedTabId).toBeNull();
  });

  it('a session without a pid is listed with no match (D-025), never guessed', () => {
    const session = createSessionWithoutPid({ name: 'no-pid-session' });

    const rows = buildSidebarRows(
      { sessions: [session], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.matchedTabId).toBeNull();
  });

  it('an empty discovery produces an empty sidebar, not an error', () => {
    const rows = buildSidebarRows({ sessions: [], rejected: [] }, createConfig(), NOW, emptyTabs());

    expect(rows).toEqual([]);
  });
});

describe('buildLiveSessionIndex (V2-T9 item 4)', () => {
  it('a live (alive/idle) session is in the index, matched tab id carried through', () => {
    const alive = createSessionWithPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      pid: 555,
      lastTranscriptWrite: NOW,
    });
    const tab = withPid(createTab({ id: 'tab-1', command: '', args: [], cwd: '/x' }), 555);
    const rows = buildSidebarRows(
      { sessions: [alive], rejected: [] },
      createConfig(),
      NOW,
      addTab(emptyTabs(), tab),
    );

    const live = buildLiveSessionIndex(rows);

    expect(live.get(alive.sessionId)).toEqual({ matchedTabId: 'tab-1' });
  });

  it('a live session with no matching tab is still in the index, with matchedTabId: null (D-025)', () => {
    const alive = createSessionWithPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      pid: 555,
      lastTranscriptWrite: NOW,
    });
    const rows = buildSidebarRows(
      { sessions: [alive], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const live = buildLiveSessionIndex(rows);

    expect(live.get(alive.sessionId)).toEqual({ matchedTabId: null });
  });

  it('an ended session is NOT in the index — the panel falls back to resumed.json for it', () => {
    const ended = createSessionWithPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      pid: 555,
      processIsAlive: false,
    });
    const rows = buildSidebarRows(
      { sessions: [ended], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const live = buildLiveSessionIndex(rows);

    expect(live.has(ended.sessionId)).toBe(false);
  });

  it('a session with no pid (unknown state) is NOT in the index', () => {
    const unknown = createSessionWithoutPid({
      sessionId: '22222222-2222-4222-8222-222222222222',
    });
    const rows = buildSidebarRows(
      { sessions: [unknown], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const live = buildLiveSessionIndex(rows);

    expect(live.has(unknown.sessionId)).toBe(false);
  });

  it('an empty sidebar produces an empty index, never an error', () => {
    expect(buildLiveSessionIndex([])).toEqual(new Map());
  });
});
