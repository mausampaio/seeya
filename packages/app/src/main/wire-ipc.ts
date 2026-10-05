/**
 * Wires every IPC channel and starts the ambient refresh (V2-T51: what was `wireIpc` in
 * `main/main.ts`, now only composition — each area's handlers live in their own `*-ipc.ts`). The
 * only logic here is "which module owns which channel" — never anything about a pty, a process,
 * or how to compute a session row (that's `pty/`, `state/` and `sidebar/`'s job).
 */
import { BrowserWindow } from 'electron';
import { type AppContext } from '../composition/index.js';
import { createAmbientState } from './ambient-state.js';
import { wireTabsIpc } from './tabs-ipc.js';
import { wireThemeIpc } from './theme-ipc.js';
import { wireSettingsIpc } from './settings-ipc.js';
import { wireTodayIpc } from './today-ipc.js';
import { wireEndDayIpc } from './end-day-ipc.js';
import { wireScheduleIpc } from './schedule-ipc.js';
import { wireDaemonIpc } from './daemon-ipc.js';
import { startAmbientRefresh } from './ambient-refresh.js';
import { wireProjectIpc } from './project-ipc.js';
import { wireProjectDetailsIpc } from './project-details-ipc.js';
import { wireSessionSearchIpc } from './session-search-ipc.js';
import { wireSessionResumeIpc } from './session-resume-ipc.js';
import { wireDirectoryPickerIpc } from './directory-picker-ipc.js';

/**
 * Wires every IPC channel to its module and starts the sidebar/status refresh loop. `ipcMain`
 * registrations are process-global, so this runs exactly ONCE per process.
 */
export function wireIpc(window: BrowserWindow, context: AppContext): void {
  const state = createAmbientState();
  const tabsIpc = wireTabsIpc(window, context);

  // V2-T30: the "Projects" section's own IPC (New project/Open/Adopt) — kept in its own module so
  // this file doesn't grow (see project-ipc.ts's own docstring). Reuses the SAME tabsIpc.tabResumeOpener
  // above: mounting a tab UI for an already-spawned pty was never resume-specific.
  const projectIpc = wireProjectIpc(
    window,
    context,
    tabsIpc.tabResumeOpener,
    () => state.latestSidebarRows,
  );
  // V2-T55 item 4: the id-search field's own IPC — same "own module, main.ts doesn't grow" split
  // `wireProjectIpc` already established.
  wireSessionSearchIpc(context);
  // V2-T83: the "Project details" dialog's own IPC — same "own module" split, reusing the push
  // `wireProjectIpc` already exposes so every action refreshes the Projects tab at once.
  wireProjectDetailsIpc(window, context, projectIpc.pushProjectsUpdate);
  // V2-T68: the Sessions tab's own "Resume" button — same "own module" split, reusing the SAME
  // tabsIpc.tabResumeOpener as every other tab-backed launcher above.
  wireSessionResumeIpc(context, tabsIpc.tabResumeOpener);
  // V2-T64: the New tab popover's "Browse…" button — same "own module" split as the two above.
  wireDirectoryPickerIpc(window);

  const resolveAndSendEffectiveTheme = wireThemeIpc(window, context);
  wireSettingsIpc(window, context, resolveAndSendEffectiveTheme);
  const today = wireTodayIpc(window, context, state, tabsIpc.tabResumeOpener);
  wireEndDayIpc(window, context, today);
  wireScheduleIpc(context);
  wireDaemonIpc(context, state);
  startAmbientRefresh(window, context, state, projectIpc, tabsIpc.getTabs);
}
