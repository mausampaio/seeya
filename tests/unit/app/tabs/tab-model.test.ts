import { describe, expect, it } from 'vitest';
import {
  addTab,
  createTab,
  emptyTabs,
  findTabByPid,
  isRunning,
  listTabs,
  markExited,
  updateTab,
  withPid,
} from '../../../../packages/app/src/tabs/tab-model.js';

describe('tab-model', () => {
  it('createTab starts running, with no pid', () => {
    const tab = createTab({ id: 't1', command: 'claude', args: [], cwd: '/tmp' });

    expect(tab.pid).toBeNull();
    expect(isRunning(tab)).toBe(true);
    expect(tab.status).toEqual({ kind: 'running' });
  });

  it('withPid fills in the pid without changing anything else', () => {
    const tab = createTab({ id: 't1', command: 'claude', args: ['--resume'], cwd: '/tmp' });

    const withPidSet = withPid(tab, 4242);

    expect(withPidSet.pid).toBe(4242);
    expect(withPidSet.command).toBe('claude');
    expect(withPidSet.args).toEqual(['--resume']);
  });

  it('markExited records the exit code and flips isRunning to false', () => {
    const tab = withPid(createTab({ id: 't1', command: '', args: [], cwd: '/tmp' }), 10);

    const exited = markExited(tab, 0);

    expect(isRunning(exited)).toBe(false);
    expect(exited.status).toEqual({ kind: 'exited', exitCode: 0 });
    // A nonzero code is preserved verbatim, not coerced to a boolean success/failure.
    expect(markExited(tab, 130).status).toEqual({ kind: 'exited', exitCode: 130 });
  });

  it('emptyTabs/addTab/listTabs: insertion order is preserved', () => {
    const t1 = createTab({ id: 'a', command: '', args: [], cwd: '/x' });
    const t2 = createTab({ id: 'b', command: '', args: [], cwd: '/y' });

    const tabs = addTab(addTab(emptyTabs(), t1), t2);

    expect(listTabs(tabs).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('updateTab applies the updater to the named tab only', () => {
    const t1 = createTab({ id: 'a', command: '', args: [], cwd: '/x' });
    const t2 = createTab({ id: 'b', command: '', args: [], cwd: '/y' });
    const tabs = addTab(addTab(emptyTabs(), t1), t2);

    const updated = updateTab(tabs, 'a', (tab) => markExited(tab, 1));

    expect(updated.get('a')?.status).toEqual({ kind: 'exited', exitCode: 1 });
    expect(updated.get('b')?.status).toEqual({ kind: 'running' });
  });

  it('updateTab is a silent no-op for an id that does not exist (never throws)', () => {
    const tabs = addTab(emptyTabs(), createTab({ id: 'a', command: '', args: [], cwd: '/x' }));

    const unchanged = updateTab(tabs, 'does-not-exist', (tab) => markExited(tab, 1));

    expect(unchanged).toBe(tabs);
  });

  it('findTabByPid finds the tab whose pid matches, or null', () => {
    const t1 = withPid(createTab({ id: 'a', command: '', args: [], cwd: '/x' }), 111);
    const t2 = createTab({ id: 'b', command: '', args: [], cwd: '/y' });
    const tabs = addTab(addTab(emptyTabs(), t1), t2);

    expect(findTabByPid(tabs, 111)?.id).toBe('a');
    expect(findTabByPid(tabs, 999)).toBeNull();
  });
});
