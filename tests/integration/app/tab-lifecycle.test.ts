/**
 * `tabs/tab-model.ts`'s `TabCollection`, exercised across the exact sequence
 * `electron/main.ts#wireIpc` applies to it — `createTab` → `onExit` → `removeTab` (V2-T3 review,
 * item 2).
 *
 * **Why this cannot exercise `main.ts` itself.** `main.ts` imports `electron` (`ipcMain`,
 * `BrowserWindow`) — under plain Node, which is what `vitest` runs on, `require('electron')`/
 * `import('electron')` resolves to the STRING PATH of the Electron binary (the same mechanism
 * `packages/app/scripts/build.mjs#launchElectron` relies on to launch it), not the real
 * `ipcMain`/`BrowserWindow` API objects — those only exist inside a real, running Electron
 * process. Importing `main.ts` here would throw the moment it tried to call `ipcMain.on(...)`.
 * That is the same reason `packages/app/src/electron/**` is excluded from the coverage floor
 * (`vitest.config.ts`'s own `APP_ELECTRON_SOURCE`) and never unit-tested directly.
 *
 * **What this test does instead:** replicates `wireIpc`'s own three one-line recipes
 * (`CHANNELS.createTab`'s handler, `PtyManager`'s `onExit` callback, and the new
 * `CHANNELS.removeTab` handler) against the REAL, pure `tabs/tab-model.ts` functions, in the same
 * order a real create → exit → remove IPC round trip fires them — proving the SEQUENCE leaves the
 * `TabCollection` exactly as intended, not just each function in isolation (already covered by
 * `tests/unit/app/tabs/tab-model.test.ts`). The second test below is the concrete regression this
 * wiring exists to prevent: a pid the OS reuses for a brand-new tab must never match a stale entry
 * `main.ts` never dropped (`CHANNELS.removeTab`'s own docstring in `ipc/channels.ts`).
 */
import { describe, expect, it } from 'vitest';
import {
  addTab,
  createTab,
  emptyTabs,
  findTabByPid,
  markExited,
  removeTab,
  updateTab,
  withPid,
} from '../../../packages/app/src/tabs/tab-model.js';

describe('TabCollection lifecycle — mirrors electron/main.ts#wireIpc', () => {
  it('created, exited, then removed: the collection ends up exactly as it started', () => {
    let tabs = emptyTabs();

    // CHANNELS.createTab's own handler: addTab, then withPid once PtyManager.create returns.
    tabs = addTab(tabs, createTab({ id: 'tab-1', command: '', args: [], cwd: '/tmp' }));
    tabs = updateTab(tabs, 'tab-1', (tab) => withPid(tab, 4242));
    expect(findTabByPid(tabs, 4242)?.id).toBe('tab-1');

    // PtyManager's own onExit callback: markExited — the tab stays, just marked (V2-T2).
    tabs = updateTab(tabs, 'tab-1', (tab) => markExited(tab, 0));
    expect(findTabByPid(tabs, 4242)?.id).toBe('tab-1');
    expect(tabs.get('tab-1')?.status).toEqual({ kind: 'exited', exitCode: 0 });

    // CHANNELS.removeTab's own handler (V2-T3 review) — only ever sent by the renderer once it
    // has already decided (via isRunning) that the process is gone.
    tabs = removeTab(tabs, 'tab-1');

    expect(tabs.size).toBe(0);
    expect(findTabByPid(tabs, 4242)).toBeNull();
  });

  it('a pid the OS reuses for a brand-new tab never matches a stale, already-removed entry', () => {
    let tabs = emptyTabs();
    tabs = addTab(tabs, createTab({ id: 'tab-1', command: '', args: [], cwd: '/tmp' }));
    tabs = updateTab(tabs, 'tab-1', (tab) => withPid(tab, 4242));
    tabs = updateTab(tabs, 'tab-1', (tab) => markExited(tab, 0));
    tabs = removeTab(tabs, 'tab-1'); // V2-T3 review: main.ts now does this on removeTab

    // The OS hands the exited process's old pid to a brand-new one.
    tabs = addTab(tabs, createTab({ id: 'tab-2', command: '', args: [], cwd: '/tmp' }));
    tabs = updateTab(tabs, 'tab-2', (tab) => withPid(tab, 4242));

    expect(findTabByPid(tabs, 4242)?.id).toBe('tab-2');
    expect(tabs.size).toBe(1);
  });

  it('removeTab for a tab main.ts never registered is a silent no-op (never throws)', () => {
    const tabs = emptyTabs();

    expect(() => removeTab(tabs, 'does-not-exist')).not.toThrow();
    expect(removeTab(tabs, 'does-not-exist').size).toBe(0);
  });
});
