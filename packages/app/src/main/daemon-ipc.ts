/**
 * The daemon / autostart / ownership-transition IPC (V2-T5b, V2-T13, V2-T21, V2-T65; V2-T51: moved
 * out of `main/main.ts`) — the shared `computeDaemonAvailabilityEvent` plus every handler that
 * starts, stops or reports on the daemon and its autostart.
 */
import { ipcMain } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  DaemonAvailabilityUpdateEvent,
  DaemonAvailabilityResponse,
  DaemonControlRequest,
  DaemonControlResponse,
  AutostartAvailabilityResponse,
  AutostartControlRequest,
  AutostartControlResponse,
  DaemonOwnershipTransitionOfferResponse,
  AnswerDaemonOwnershipTransitionRequest,
} from '../ipc/channels.js';
import { checkLiveLock } from '@seeya-ai/engine/scheduler/daemon-state.js';
import { type AppContext } from '../composition/index.js';
import { resolveDaemonControlAvailability } from '../state/daemon-control-panel.js';
import { resolveAutostartControlAvailability } from '../state/autostart-control-panel.js';
import {
  formatAutostartDisableResult,
  formatAutostartEnableResult,
} from '@seeya-ai/engine/application/autostart-state.js';
import {
  resolveAutostartReport,
  DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
} from '../state/autostart-cache.js';
import { holdForDaemonOwnershipVerification } from './verification/index.js';
import type { AmbientState } from './ambient-state.js';

/**
 * The daemon pill's own availability — shared by `CHANNELS.getDaemonAvailability`'s own handler,
 * the ambient tick's own `daemonAvailabilityUpdate` push, and `daemonControl`'s own post-action
 * recompute (same deduplication reasoning as `computeScheduleEvent` above).
 */
export async function computeDaemonAvailabilityEvent(
  context: Pick<AppContext, 'storage' | 'processControl' | 'clock'>,
): Promise<DaemonAvailabilityUpdateEvent> {
  const liveLockCheck = await checkLiveLock({
    storage: context.storage,
    processControl: context.processControl,
    clock: context.clock,
  });
  return resolveDaemonControlAvailability(liveLockCheck);
}

export function wireDaemonIpc(context: AppContext, state: AmbientState): void {
  // V2-T5b item 3: "Start daemon"/"Stop daemon" — the renderer decides WHICH action from its own
  // last-known `DaemonControlAvailability` (never re-derived here, D-041); this handler just runs
  // it and hands back the literal result text.
  //
  // V2-T21 item 1: the response ALSO carries the freshly recomputed availability (a `checkLiveLock`
  // right after the action, same call `buildStatusPanelText`'s own `describeDaemonState` and the
  // ambient tick below already make) — the measured defect was the button staying mislabeled, and
  // a click in that window sending the stale action, for up to `REFRESH_INTERVAL_MS` until the
  // next ambient tick's own `availabilityUpdated` caught up.
  ipcMain.handle(
    CHANNELS.daemonControl,
    async (_event, request: DaemonControlRequest): Promise<DaemonControlResponse> => {
      const resultText =
        request.action === 'start' ? await context.startDaemon() : await context.stopDaemon();
      return { resultText, availability: await computeDaemonAvailabilityEvent(context) };
    },
  );

  // V2-T75 PO review (round 3): fetched once at startup — same reasoning as `getScheduleStrip`
  // above.
  ipcMain.handle(CHANNELS.getDaemonAvailability, async (): Promise<DaemonAvailabilityResponse> =>
    computeDaemonAvailabilityEvent(context),
  );

  // V2-T13 item 4: "Enable autostart"/"Disable autostart" — the button only ever shows when
  // `context.daemonOwner.kind === 'app'` (the renderer's own availability decides which action to
  // send, same D-041 discipline `daemonControl` above already follows); `enableAppAutostart`
  // registers the app's own daemon target (Electron's binary + ELECTRON_RUN_AS_NODE=1), never the
  // bare CLI-style `Autostart.enable(binaryPath)` call.
  //
  // V2-T21 item 1: the measured defect. `state.autostartCache` (`state/autostart-cache.ts`) is only
  // refreshed by the ambient tick below, every `DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS` (60s) — left
  // untouched here, the label stayed wrong for up to a minute AND a click landing in that window
  // sent the STALE action (the mantenedor's own "Autostart was already disabled. Nothing
  // changed."). This handler now forces a fresh `Autostart.status()` right after the action
  // (`resolveAutostartReport` with `entry: null`, the same helper the ambient tick uses, never a
  // second implementation of "when is the cache stale"), so both the cache AND the response's own
  // `availability` reflect what just happened, not what was true before the click.
  ipcMain.handle(
    CHANNELS.autostartControl,
    async (_event, request: AutostartControlRequest): Promise<AutostartControlResponse> => {
      const resultText =
        request.action === 'enable'
          ? formatAutostartEnableResult(await context.enableAppAutostart())
          : formatAutostartDisableResult(await context.autostart.disable());
      state.autostartCache = await resolveAutostartReport(
        null,
        context.clock.now(),
        DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
        () => context.autostart.status(),
      );
      return {
        resultText,
        availability: resolveAutostartControlAvailability(
          context.daemonOwner,
          state.autostartCache.status,
        ),
      };
    },
  );

  // V2-T65: Settings' own General section — fetched once when it mounts. Answers from the
  // ambient-tick cache ONLY, never a direct `context.autostart.status()` call of its own
  // (`CHANNELS.getAutostartAvailability`'s own docstring: that call measured up to ~6s cold).
  // `{ kind: 'unknown' }` before the first tick has run yet (D-025 — the switch shows "cannot
  // verify" rather than guessing enabled/disabled) — the very next `autostartAvailabilityUpdate`
  // push (within `REFRESH_INTERVAL_MS`) corrects it.
  ipcMain.handle(CHANNELS.getAutostartAvailability, (): AutostartAvailabilityResponse =>
    state.autostartCache === null
      ? { kind: 'unknown' }
      : resolveAutostartControlAvailability(context.daemonOwner, state.autostartCache.status),
  );

  // V2-T13 item 5 (D-045 item 1): fetched once at startup — see `renderer.ts`'s own `main()`.
  ipcMain.handle(
    CHANNELS.getDaemonOwnershipTransitionOffer,
    async (): Promise<DaemonOwnershipTransitionOfferResponse> => {
      const shouldOffer = await context.checkDaemonOwnershipTransitionOffer();
      return {
        shouldOffer,
        launchPath: context.daemonOwner.kind === 'app' ? context.daemonOwner.launchPath : '',
      };
    },
  );

  ipcMain.handle(
    CHANNELS.answerDaemonOwnershipTransition,
    async (_event, request: AnswerDaemonOwnershipTransitionRequest): Promise<void> => {
      await context.applyDaemonOwnershipTransition(request.answer);
      // SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS (V2-T71): see
      // `holdForDaemonOwnershipVerification`'s own docstring — a no-op outside a verification
      // run, so the real button's own latency is exactly what it always was.
      await holdForDaemonOwnershipVerification(context.clock);
    },
  );
}
