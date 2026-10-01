import { describe, expect, it } from 'vitest';
import {
  buildTabStripEntries,
  findOpenPageTab,
  nextActiveIdAfterRemoval,
  type StripTab,
} from '../../../../packages/app/src/state/tab-strip.js';
import { createTab, markExited, withPid } from '../../../../packages/app/src/tabs/tab-model.js';

function terminalStripTab(
  overrides: Partial<StripTab & { readonly kind: 'terminal' }> = {},
): StripTab {
  return {
    kind: 'terminal',
    id: 'tab-1',
    tab: createTab({ id: 'tab-1', command: 'claude', args: [], cwd: '/code/app' }),
    label: 'claude',
    origin: 'command',
    spawnRequest: null,
    ...overrides,
  };
}

describe('buildTabStripEntries (V2-T64)', () => {
  it('a page tab shows its own fixed label/icon, never an exited suffix', () => {
    const tabs: StripTab[] = [{ kind: 'page', id: 'page-today', pageKind: 'today' }];
    expect(buildTabStripEntries(tabs, 'page-today')).toEqual([
      {
        id: 'page-today',
        label: 'Today',
        exitedText: null,
        icon: 'calendar',
        active: true,
        exited: false,
      },
    ]);
  });

  it('a running terminal tab shows its plain label, with no exited suffix', () => {
    const tabs = [terminalStripTab({ origin: 'project', label: 'auth-hardening' })];
    const [entry] = buildTabStripEntries(tabs, null);
    expect(entry).toEqual({
      id: 'tab-1',
      label: 'auth-hardening',
      exitedText: null,
      icon: 'folder',
      active: false,
      exited: false,
    });
  });

  it('an exited terminal tab keeps its plain label and reports "exited (N)" separately', () => {
    const exitedTab = markExited(
      withPid(createTab({ id: 'tab-1', command: '', args: [], cwd: '/code/app' }), 42),
      1,
    );
    const tabs = [terminalStripTab({ tab: exitedTab, label: 'shell' })];
    const [entry] = buildTabStripEntries(tabs, 'tab-1');
    expect(entry?.label).toBe('shell');
    expect(entry?.exitedText).toBe('exited (1)');
    expect(entry?.exited).toBe(true);
    expect(entry?.active).toBe(true);
  });

  it('preserves the given order, interleaving terminal and page tabs', () => {
    const tabs: StripTab[] = [
      terminalStripTab({ id: 'tab-1' }),
      { kind: 'page', id: 'page-sessions', pageKind: 'sessions' },
      terminalStripTab({ id: 'tab-2' }),
    ];
    expect(buildTabStripEntries(tabs, null).map((entry) => entry.id)).toEqual([
      'tab-1',
      'page-sessions',
      'tab-2',
    ]);
  });
});

describe('nextActiveIdAfterRemoval (V2-T64)', () => {
  it('picks the next remaining tab in order', () => {
    const tabs: StripTab[] = [terminalStripTab({ id: 'tab-1' }), terminalStripTab({ id: 'tab-2' })];
    expect(nextActiveIdAfterRemoval(tabs, 'tab-1')).toBe('tab-2');
  });

  it('returns null once nothing remains', () => {
    const tabs: StripTab[] = [terminalStripTab({ id: 'tab-1' })];
    expect(nextActiveIdAfterRemoval(tabs, 'tab-1')).toBeNull();
  });
});

describe('findOpenPageTab (V2-T64)', () => {
  it('finds an already-open page tab by kind', () => {
    const tabs: StripTab[] = [{ kind: 'page', id: 'page-projects', pageKind: 'projects' }];
    expect(findOpenPageTab(tabs, 'projects')?.id).toBe('page-projects');
  });

  it('is undefined when that page tab is not open', () => {
    expect(findOpenPageTab([], 'projects')).toBeUndefined();
  });
});
