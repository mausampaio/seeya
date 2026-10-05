/**
 * The 10-second ambient refresh (V2-T2, V2-T9, V2-T17, V2-T18, V2-T30; V2-T51: moved out of
 * `main/main.ts`'s `wireIpc`) — one discovery per cycle, shared by every push the window receives.
 */
import { BrowserWindow } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  SessionsUpdateEvent,
  StatusUpdateEvent,
  TodayUpdateEvent,
  AutostartAvailabilityUpdateEvent,
} from '../ipc/channels.js';
import { type AppContext } from '../composition/index.js';
import { resolveAutostartControlAvailability } from '../state/autostart-control-panel.js';
import { type TabCollection } from '../tabs/tab-model.js';
import { buildSidebarRows, buildLiveSessionIndex } from '../sidebar/sidebar-data.js';
import { buildStatusPanelText } from '../state/status-panel.js';
import { runRefreshLoop } from '../state/refresh-loop.js';
import {
  resolveAutostartReport,
  DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
} from '../state/autostart-cache.js';
import { refreshTodayPanelLiveness } from '../state/today-panel.js';
import { writeStartupTiming } from './verification/index.js';
import type { AmbientState } from './ambient-state.js';
import type { ProjectIpcHandle } from './project-ipc.js';
import { computeScheduleEvent } from './schedule-ipc.js';
import { computeDaemonAvailabilityEvent } from './daemon-ipc.js';

/**
 * How often the sidebar/status panel refresh (docs/PLANO-DE-ENTREGA.md V2-T2: "atualizada em
 * intervalo pelo relógio injetado"). Independent of the daemon's own 30s poll
 * (`scheduler/loop.ts#POLL_INTERVAL_MS`) — this is a read-only UI refresh, not a scheduling
 * decision.
 *
 * **10s, not 5s (PO review of V2-T2).** One cycle does one `SessionProvider.list()` (shared by the
 * sidebar and the status panel — see `sidebar/sidebar-data.ts`'s own docstring) plus
 * `describeDaemonState` every time (~0.24s, measured on the PO's real machine) — cheap enough for
 * 5s, but 10s halves the steady-state cost for a read-only refresh nobody asked to be
 * sub-5-second, and gives `state/autostart-cache.ts`'s own 60s refresh interval a rounder multiple
 * (six ticks) to reason about.
 */
export const REFRESH_INTERVAL_MS = 10_000;

export function startAmbientRefresh(
  window: BrowserWindow,
  context: AppContext,
  state: AmbientState,
  projectIpc: ProjectIpcHandle,
  getTabs: () => TabCollection,
): void {
  // V2-T17 item 4: set once the first `sessionsUpdate` of this window's lifetime has been sent —
  // `writeStartupTiming`'s own docstring has the reasoning. `SEEYA_APP_STARTUP_TIMING_PATH` unset
  // (every normal run) means this flag is simply never consulted.
  let startupTimingWritten = false;

  void runRefreshLoop({
    clock: context.clock,
    intervalMs: REFRESH_INTERVAL_MS,
    shouldStop: () => window.isDestroyed(),
    // One discovery per cycle, shared by the sidebar and the status panel (PO review of V2-T2,
    // `docs/QUESTOES.md` Q-071) — the old version called `sessionProvider.list()` twice per tick
    // (once here, once inside `buildStatusPanelText`), doubling a real, measured ~239ms cost for
    // no reason. The autostart line is cached and only re-queried every
    // `DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS` (`state/autostart-cache.ts`'s own docstring has the
    // 6-second-on-first-call measurement that motivates this).
    onTick: async () => {
      const discovery = await context.sessionProvider.list();
      const now = context.clock.now();
      // V2-T14 item 3 (V2-T16: `AppContext` no longer even HAS a startup config snapshot to reach
      // for by mistake): read fresh every tick, like `dayState` below already is — a
      // settings-panel save must never show correctly for one tick and then flip back to a stale
      // value on the next ambient refresh (at most REFRESH_INTERVAL_MS later). Reused for the
      // sidebar/status text too, so
      // the whole window agrees with itself about what's currently in config.json, not just the
      // faixa de horário the plan entry calls out by name.
      const liveConfig = await context.storage.readConfig();

      const rows = buildSidebarRows(discovery, liveConfig, now, getTabs());
      // V2-T9 item 4: cached for getTodayPanel's own handler above — the same discovery this
      // cycle already did, never a second SessionProvider.list() call just for "Today".
      state.latestSidebarRows = rows;
      const sessionsEvent: SessionsUpdateEvent = { rows };
      window.webContents.send(CHANNELS.sessionsUpdate, sessionsEvent);

      // V2-T30: the "Projects" section, same tick — reuses `rows` above (no second discovery),
      // plus one small `.seeya-lock` read per project (the task's own declared cost). The FIRST
      // paint doesn't depend on this push arriving in time — see `CHANNELS.getProjectsPanel`'s own
      // docstring.
      await projectIpc.pushProjectsUpdate();

      const startupTimingPath = process.env.SEEYA_APP_STARTUP_TIMING_PATH;
      if (startupTimingPath !== undefined && !startupTimingWritten) {
        startupTimingWritten = true;
        await writeStartupTiming(context.clock, startupTimingPath);
      }

      // V2-T18 item 2: the "Today" panel tracks this same tick's own discovery — a session opened
      // outside the window stops showing "not running now" without a reload (the second achado
      // this task fixes). Reuses `state.latestTodayPanelInputs` untouched (no second findPendingBriefing/
      // readCwdHistory scan); skipped entirely until the window's own first getTodayPanel call has
      // populated that cache (refreshTodayPanelLiveness's own `null` case, D-025).
      const todayPanelData = refreshTodayPanelLiveness(
        state.latestTodayPanelInputs,
        buildLiveSessionIndex(rows),
      );
      if (todayPanelData !== null) {
        const todayEvent: TodayUpdateEvent = todayPanelData;
        window.webContents.send(CHANNELS.todayUpdate, todayEvent);
      }

      state.autostartCache = await resolveAutostartReport(
        state.autostartCache,
        now,
        DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
        () => context.autostart.status(),
      );

      const text = await buildStatusPanelText({
        discovery,
        config: liveConfig,
        clock: context.clock,
        storage: context.storage,
        processControl: context.processControl,
        autostartReport: state.autostartCache.report,
      });
      const statusEvent: StatusUpdateEvent = { text };
      window.webContents.send(CHANNELS.statusUpdate, statusEvent);

      // V2-T5b item 1: the faixa de horário — same `decideSchedule` the daemon itself polls
      // every 30s, read fresh every tick (never cached: a snooze/skip typed in another terminal,
      // or the daemon's own poll, can change `estado.json` between ticks — D-025, the interface
      // never shows a stale decision on purpose).
      const scheduleEvent = await computeScheduleEvent(context, liveConfig);
      window.webContents.send(CHANNELS.scheduleUpdate, scheduleEvent);

      // V2-T5b item 3: a SECOND checkLiveLock this tick (buildStatusPanelText's own
      // describeDaemonState already did one for the status panel's text) — a deliberate,
      // measured-acceptable cost (the SAME ~0.24-0.88s class this file's own REFRESH_INTERVAL_MS
      // docstring already accepts once per tick for describeDaemonState), not shared: threading a
      // precomputed LiveLockCheck INTO describeDaemonState would mean changing that function's own
      // signature for a caller outside its existing two (seeya status/--status), which is a
      // bigger change than this task's own scope.
      const daemonAvailabilityEvent = await computeDaemonAvailabilityEvent(context);
      window.webContents.send(CHANNELS.daemonAvailabilityUpdate, daemonAvailabilityEvent);

      // V2-T13 item 4: from the SAME cached status `autostartReport` above already reads (never a
      // second Autostart.status() call, Q-071's own measurement).
      const autostartAvailabilityEvent: AutostartAvailabilityUpdateEvent =
        resolveAutostartControlAvailability(context.daemonOwner, state.autostartCache.status);
      window.webContents.send(CHANNELS.autostartAvailabilityUpdate, autostartAvailabilityEvent);
    },
  });
}
