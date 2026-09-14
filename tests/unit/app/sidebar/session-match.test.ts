import { describe, expect, it } from 'vitest';
import { createSessionWithPid, createSessionWithoutPid } from '../../core/_fixtures.js';
import {
  addTab,
  createTab,
  emptyTabs,
  withPid,
} from '../../../../packages/app/src/tabs/tab-model.js';
import {
  matchingTabId,
  matchSessionsToTabs,
} from '../../../../packages/app/src/sidebar/session-match.js';

describe('session-match', () => {
  it('matches a session to the tab whose pty pid equals the session pid', () => {
    const tab = withPid(createTab({ id: 'tab-1', command: 'claude', args: [], cwd: '/x' }), 555);
    const tabs = addTab(emptyTabs(), tab);
    const session = createSessionWithPid({ pid: 555 });

    expect(matchingTabId(tabs, session)).toBe('tab-1');
  });

  it('no match when no open tab has that pid (D-025: honest null, not a guess)', () => {
    const tab = withPid(createTab({ id: 'tab-1', command: 'claude', args: [], cwd: '/x' }), 555);
    const tabs = addTab(emptyTabs(), tab);
    const session = createSessionWithPid({ pid: 999 });

    expect(matchingTabId(tabs, session)).toBeNull();
  });

  it('a session without a pid never matches any tab (the known codex-on-Windows limitation)', () => {
    const tab = withPid(createTab({ id: 'tab-1', command: '', args: [], cwd: '/x' }), 555);
    const tabs = addTab(emptyTabs(), tab);
    const session = createSessionWithoutPid();

    expect(matchingTabId(tabs, session)).toBeNull();
  });

  it('a tab with no pid yet (pty not spawned) never matches', () => {
    const tab = createTab({ id: 'tab-1', command: '', args: [], cwd: '/x' });
    const tabs = addTab(emptyTabs(), tab);
    const session = createSessionWithPid({ pid: 555 });

    expect(matchingTabId(tabs, session)).toBeNull();
  });

  it('matchSessionsToTabs pairs every session with its match (or null), preserving order', () => {
    const tab = withPid(createTab({ id: 'tab-1', command: '', args: [], cwd: '/x' }), 555);
    const tabs = addTab(emptyTabs(), tab);
    const matched = createSessionWithPid({
      pid: 555,
      sessionId: '11111111-1111-4111-8111-111111111111',
    });
    const unmatched = createSessionWithPid({
      pid: 777,
      sessionId: '22222222-2222-4222-8222-222222222222',
    });

    const result = matchSessionsToTabs(tabs, [matched, unmatched]);

    expect(result).toEqual([
      { session: matched, matchedTabId: 'tab-1' },
      { session: unmatched, matchedTabId: null },
    ]);
  });
});
