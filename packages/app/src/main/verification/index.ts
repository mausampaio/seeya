/**
 * The ONE module production code imports from `main/verification/` (V2-T51). Everything the
 * `SEEYA_APP_*` instrumentation does — fake adapters, captures, click automations, the hooks
 * production handlers call — lives behind it, so a reader of `main/main.ts` and the IPC modules
 * never has to wade through it, and the normal path (no `SEEYA_APP_*` variable set) is exactly
 * what it was before any of this existed. Every function here is a no-op unless its own variable
 * is set; none is read by `npm run app` or the README (AGENTS.md lists each one).
 */
import type { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import {
  registerRendererConsoleForwarding,
  registerScreenshotCapture,
  registerProjectsTabStatesCapture,
  registerButtonCenteringCapture,
  registerSessionsTabStatesCapture,
  registerProjectResumeCapture,
  registerWindowMinCapture,
  registerConfirmationsCapture,
  registerDaemonOwnershipCapture,
  registerAdoptionFlowCapture,
  registerProjectDetailsCapture,
  registerArchiveCapture,
  registerSelectStatesCapture,
  registerMenuAndClipboardVerification,
  registerSettingsCloseCapture,
} from './window-captures.js';
import {
  registerOpenShellTabAutomation,
  registerSwitchToAllProjectsAutomation,
  registerHoverFirstFavoriteAutomation,
  registerTerminalResizeReproAutomation,
  registerFocusReturnAutomation,
  registerTabStripDemoAutomation,
} from './click-automation-tabs.js';
import {
  registerResumeAllAutomation,
  registerOpenTodayTabAutomation,
  registerEndDayAutomation,
  registerEndDayFakeAutomation,
} from './click-automation-today.js';
import {
  registerSnooze15Automation,
  registerEditSettingsAutomation,
  registerUndoSnoozeAutomation,
  registerSetEndOfDayAutomation,
  registerClickSkipTodayAutomation,
  registerOpenSnoozeMenuAutomation,
} from './click-automation-schedule.js';
import {
  registerToggleSidebarAutomation,
  registerDeclineDaemonOwnershipAutomation,
  registerResizeSidebarAutomation,
  registerNarrowSidebarAutomation,
  registerOpenSessionsTabAutomation,
} from './click-automation-sidebar.js';

export { buildVerificationContextOverrides } from './context-overrides.js';
export {
  holdForVerification,
  holdForDaemonOwnershipVerification,
  writeStartupTiming,
  recordCreatedTabPid,
  recordResizeForVerification,
} from './hooks.js';

/**
 * Registers every capture and click automation on a freshly created window. The order is the one
 * `createWindow` registered them in before V2-T51 (two flags set together start their steps in the
 * same relative order they always did).
 */
export function registerWindowVerification(window: BrowserWindow, clock: Clock): void {
  registerRendererConsoleForwarding(window);
  registerScreenshotCapture(window, clock);
  registerProjectsTabStatesCapture(window, clock);
  registerButtonCenteringCapture(window, clock);
  registerSessionsTabStatesCapture(window, clock);
  registerProjectResumeCapture(window, clock);
  registerWindowMinCapture(window, clock);
  registerConfirmationsCapture(window, clock);
  registerDaemonOwnershipCapture(window, clock);
  registerAdoptionFlowCapture(window, clock);
  registerProjectDetailsCapture(window, clock);
  registerArchiveCapture(window, clock);
  registerSelectStatesCapture(window, clock);
  registerOpenShellTabAutomation(window, clock);
  registerMenuAndClipboardVerification(window, clock);
  registerSwitchToAllProjectsAutomation(window, clock);
  registerHoverFirstFavoriteAutomation(window, clock);
  registerResumeAllAutomation(window, clock);
  registerOpenTodayTabAutomation(window, clock);
  registerEndDayAutomation(window, clock);
  registerEndDayFakeAutomation(window, clock);
  registerSnooze15Automation(window, clock);
  registerToggleSidebarAutomation(window, clock);
  registerEditSettingsAutomation(window, clock);
  registerUndoSnoozeAutomation(window, clock);
  registerSetEndOfDayAutomation(window, clock);
  registerClickSkipTodayAutomation(window, clock);
  registerSettingsCloseCapture(window, clock);
  registerDeclineDaemonOwnershipAutomation(window, clock);
  registerResizeSidebarAutomation(window, clock);
  registerNarrowSidebarAutomation(window, clock);
  registerOpenSnoozeMenuAutomation(window, clock);
  registerTerminalResizeReproAutomation(window, clock);
  registerOpenSessionsTabAutomation(window, clock);
  registerFocusReturnAutomation(window, clock);
  registerTabStripDemoAutomation(window, clock);
}
