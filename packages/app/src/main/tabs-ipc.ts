/**
 * The tab/pty IPC (V2-T2, V2-T3, V2-T4; V2-T51: moved out of `main/main.ts`'s `wireIpc`) — the
 * `PtyManager`, the window's `TabCollection`, the `TabResumeOpener` every tab-backed launcher
 * reuses, and the `createTab`/`writeTab`/`resizeTab`/`closeTab`/`removeTab` handlers.
 */
import { BrowserWindow, ipcMain } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  CreateTabRequest,
  CreateTabResponse,
  ResizeTabRequest,
  CloseTabRequest,
  RemoveTabRequest,
  WriteTabRequest,
  TabDataEvent,
  TabExitEvent,
  ResumeTabOpenedEvent,
  ResumeTabOpenedKind,
} from '../ipc/channels.js';
import { type AppContext } from '../composition/index.js';
import {
  addTab,
  createTab,
  emptyTabs,
  markExited,
  removeTab,
  updateTab,
  withPid,
  type TabCollection,
} from '../tabs/tab-model.js';
import { ExitListenerRegistry } from '../resume/exit-listener-registry.js';
import { type OpenedResumeTab, type TabResumeOpener } from '../resume/tab-session-resumer.js';
import { recordCreatedTabPid, recordResizeForVerification } from './verification/index.js';

export interface TabsIpc {
  readonly tabResumeOpener: TabResumeOpener;
  /** The window's current tabs — read by the ambient tick (`buildSidebarRows`). */
  readonly getTabs: () => TabCollection;
}

export function wireTabsIpc(window: BrowserWindow, context: AppContext): TabsIpc {
  // Mutated only by the two places below that change a tab's lifecycle (created, exited) — never
  // read by anything outside this function, so a plain closed-over variable is enough; no reason
  // for the heavier ceremony `pty/pty-manager.ts`'s own class gets (that one is exported and
  // tested on its own).
  let tabs: TabCollection = emptyTabs();
  // V2-T4 item 2: lets the SAME onExit callback below also notify TabSessionResumer's
  // fast-failure race for the specific tabs it opened — ExitListenerRegistry's own docstring.
  const exitListenerRegistry = new ExitListenerRegistry();
  let nextResumeTabId = 0;

  const ptyManager = context.buildPtyManager({
    onData: (id, data) => {
      const event: TabDataEvent = { id, data };
      window.webContents.send(CHANNELS.tabData, event);
    },
    onExit: (id, exitCode) => {
      tabs = updateTab(tabs, id, (tab) => markExited(tab, exitCode));
      const event: TabExitEvent = { id, exitCode };
      window.webContents.send(CHANNELS.tabExit, event);
      exitListenerRegistry.fire(id, exitCode);
    },
  });

  /**
   * The real `TabResumeOpener` (V2-T4 item 2) — glue over this function's own `ptyManager`/`tabs`,
   * the same two things `CHANNELS.createTab`'s handler below already uses, so a resumed session's
   * tab is indistinguishable from a command-bar one once open (same `PtyManager`, same
   * `TabCollection`, same pid the sidebar matches by). The one real difference: the RENDERER never
   * initiates this — `resumeTabOpened` tells it to create the `@xterm/xterm` instance for an `id`
   * whose pty this process already spawned, instead of the renderer asking main to spawn one.
   */
  async function openResumeTab(options: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
    readonly kind: ResumeTabOpenedKind;
  }): Promise<OpenedResumeTab> {
    const resolved = await resolveHarnessOrThrow(context, options.command, options.args);
    nextResumeTabId += 1;
    const id = `resume-${nextResumeTabId}`;
    tabs = addTab(tabs, createTab({ id, command: options.label, args: [], cwd: options.cwd }));
    const pid = ptyManager.create(id, {
      command: resolved.command,
      args: resolved.args,
      cwd: options.cwd,
      env: context.tabEnv,
      // Reasonable initial size — same as any tab: the renderer's own FitAddon corrects it once
      // the tab is actually shown, the same way an ordinary command-bar tab's first size is only
      // ever a starting point (`renderer.ts#openTab`'s own `terminal.cols`/`rows`).
      cols: 80,
      rows: 24,
    });
    tabs = updateTab(tabs, id, (tab) => withPid(tab, pid));
    const event: ResumeTabOpenedEvent = {
      id,
      label: options.label,
      cwd: options.cwd,
      pid,
      kind: options.kind,
    };
    window.webContents.send(CHANNELS.resumeTabOpened, event);
    return { id, pid };
  }

  const tabResumeOpener: TabResumeOpener = {
    openTab: openResumeTab,
    onceExit: (id, listener) => exitListenerRegistry.register(id, listener),
  };

  ipcMain.handle(
    CHANNELS.createTab,
    async (_event, request: CreateTabRequest): Promise<CreateTabResponse> => {
      // Empty command means "the default system shell" (docs/PLANO-DE-ENTREGA.md V2-T2 step (b)):
      // pty/default-shell.ts needs no PATH walk. A named harness (claude/codex, or anything else
      // typed) resolves through the engine's adapters/process/resolve-command.ts instead, exactly
      // the way a real shell would find it (V2-T2 item 4/step (c)).
      const resolved =
        request.command === ''
          ? context.defaultShell
          : await resolveHarnessOrThrow(context, request.command, request.args);
      const cwd = request.cwd === '' ? context.homeDir : request.cwd;
      tabs = addTab(
        tabs,
        createTab({ id: request.id, command: request.command, args: request.args, cwd }),
      );
      const pid = ptyManager.create(request.id, {
        command: resolved.command,
        args: resolved.args,
        cwd,
        env: context.tabEnv,
        cols: request.cols,
        rows: request.rows,
      });
      tabs = updateTab(tabs, request.id, (tab) => withPid(tab, pid));
      // SEEYA_APP_VERIFICATION_TAB_PID_PATH: see `main/verification/hooks.ts#recordCreatedTabPid`
      // (V2-T75 PO review, round 3, item 4 — the comment that explains it moved with the code).
      await recordCreatedTabPid(pid);
      return { id: request.id, pid };
    },
  );

  ipcMain.on(CHANNELS.writeTab, (_event, request: WriteTabRequest) => {
    ptyManager.write(request.id, request.data);
  });

  ipcMain.on(CHANNELS.resizeTab, (_event, request: ResizeTabRequest) => {
    ptyManager.resize(request.id, request.cols, request.rows);
    recordResizeForVerification(context.clock, request);
  });

  // docs/PLANO-DE-ENTREGA.md V2-T2 item 3: "fechar a aba encerra o processo". The tab's `onExit`
  // (registered above, in `buildPtyManager`) still fires normally and marks it as ended (not
  // removed) — closeTab only asks the process to end, it never removes the tab itself.
  ipcMain.on(CHANNELS.closeTab, (_event, request: CloseTabRequest) => {
    ptyManager.closeTab(request.id);
  });

  // V2-T3 review: the renderer only ever sends this for a tab whose process has already exited
  // (`renderer.ts#removeTabUi`, the same distinction `closeTab` above never needed) — keeps this
  // `TabCollection` from still holding a stale entry, which is what let a NEW session with a
  // reused pid falsely match a removed tab in the sidebar (`CHANNELS.removeTab`'s own docstring).
  // `ptyManager` needs no matching call: `PtyManager` was never asked to track this tab in the
  // first place once its own `onExit` already deleted the entry (`pty-manager.ts`'s own
  // docstring on `handleFor`).
  ipcMain.on(CHANNELS.removeTab, (_event, request: RemoveTabRequest) => {
    tabs = removeTab(tabs, request.id);
  });

  return { tabResumeOpener, getTabs: () => tabs };
}

/** Resolves a named harness command against the real `PATH`, or throws a message naming exactly
 * where it looked (AGENTS.md's error-message rule) — `ipcMain.handle` turns a thrown error into a
 * rejected promise on the renderer side, which `renderer.ts#openTab` shows in the tab itself. */
async function resolveHarnessOrThrow(
  context: AppContext,
  command: string,
  args: readonly string[],
): Promise<{ readonly command: string; readonly args: readonly string[] }> {
  const result = await context.resolveHarnessCommand(command, args);
  if (result.kind === 'resolved') {
    return result.resolved;
  }
  throw new Error(
    `could not find "${command}" — searched: ${result.unresolved.searched.join(', ') || '(PATH is empty)'}`,
  );
}
