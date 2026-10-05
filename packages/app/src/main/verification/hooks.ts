/**
 * The verification hooks that production IPC handlers call (V2-T51: moved out of
 * `main/main.ts`). Every one is a no-op when its `SEEYA_APP_*` variable is unset — which is every
 * normal run, `npm run app` included — so a handler calling one behaves exactly as it did before
 * the hook existed. Reached only through `main/verification/index.ts`.
 */
import { appendFile, writeFile } from 'node:fs/promises';
import type { ResizeTabRequest } from '../../ipc/channels.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

/**
 * SEEYA_APP_VERIFY_HOLD_SKIP_MS (V2-T79): holds the real `CHANNELS.skipToday` IPC response
 * pending for the given number of milliseconds before it resolves — "instrumentação que segura
 * uma ação pendente" (this task's own prescribed technique for proving a `loading` button stays
 * centered), rather than racing a screenshot against `skipTodayNow`'s own near-instant local
 * write (which a fixed sleep before capturing could miss on a slower CI machine, or catch too
 * early on a faster one). `skipTodayNow` itself is unchanged — this only delays HANDING BACK its
 * already-computed result, so the write to the disposable `estado.json` this runs against still
 * happens exactly once, synchronously with the real call, never duplicated or faked. Never read
 * by `npm run app` or the README; absent, this is a no-op (`undefined`/non-finite both pass
 * straight through, same guard shape as `quitAfterConfiguredDelay` above).
 */
export async function holdForVerification(clock: Clock): Promise<void> {
  const raw = process.env.SEEYA_APP_VERIFY_HOLD_SKIP_MS;
  if (raw === undefined) {
    return;
  }
  const holdMs = Number(raw);
  if (Number.isFinite(holdMs)) {
    await clock.sleep(holdMs);
  }
}

/**
 * SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS (V2-T71): same "instrumentação que segura uma
 * ação pendente" technique as `holdForVerification`/`SEEYA_APP_VERIFY_HOLD_SKIP_MS` above, for the
 * daemon-ownership transition dialog's own `Leave it as it is` click — `saveDaemonOwnershipTransitionAnswer('declined')`
 * is a harmless, near-instant write to the FIXTURE's own `daemon-ownership-transition.json`
 * (`composition/daemon-ownership-transition.ts`'s own docstring: `'declined'` never touches a
 * real daemon or autostart), but a screenshot proving the button's own `loading` state needs the
 * response held open long enough to land inside that window, same reasoning as the skip-today
 * case. Never read by `npm run app` or the README; absent, a no-op.
 */
export async function holdForDaemonOwnershipVerification(clock: Clock): Promise<void> {
  const raw = process.env.SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS;
  if (raw === undefined) {
    return;
  }
  const holdMs = Number(raw);
  if (Number.isFinite(holdMs)) {
    await clock.sleep(holdMs);
  }
}

/**
 * V2-T17 item 4: opt-in instrumentation for the "time until the session list is on screen"
 * measurement (`docs/DESEMPENHO.md`). Writes the wall-clock instant (via the injected `Clock`,
 * D-019 — `process.hrtime`/`Date.now()` are banned outside `adapters/clock/` by
 * `eslint.config.js`'s own rule, which does not exempt this directory) at which the FIRST
 * `sessionsUpdate` reached the renderer, to the file `SEEYA_APP_STARTUP_TIMING_PATH` names.
 *
 * **What this measures, precisely (D-025):** the instant `main.ts` sent the sidebar data over
 * IPC, not the instant Chromium painted it — the two are microseconds apart next to the
 * multi-hundred-millisecond `SessionProvider.list()` call that precedes this send (this file's
 * own `REFRESH_INTERVAL_MS` docstring has the ~0.24s measurement), so this is close enough for a
 * "how long until the list appears" budget without adding a second IPC round trip just to have
 * the renderer confirm its own paint.
 *
 * A measurement script spawns this process, records its own launch instant with the OS clock,
 * and subtracts this file's timestamp from it — both instants come from the same machine's
 * clock, so comparing across the two processes is safe even though neither one reads the other's
 * clock directly. Same "instrumentação só do spike" discipline as every other `SEEYA_APP_*` flag
 * in this file: unset in every normal run, never read by `npm run app`.
 */
export async function writeStartupTiming(clock: Clock, timingPath: string): Promise<void> {
  const payload = JSON.stringify({ sessionsListSentAt: clock.now().toISOString() });
  await writeFile(timingPath, payload, 'utf8');
}

/**
 * SEEYA_APP_VERIFICATION_TAB_PID_PATH: called by `CHANNELS.createTab`'s handler with the pid it
 * just spawned. A no-op when the variable is unset.
 */
export async function recordCreatedTabPid(pid: number): Promise<void> {
  // SEEYA_APP_VERIFICATION_TAB_PID_PATH: same "instrumentação só do spike" class as every
  // other `SEEYA_APP_*` flag this file reads (never set by `npm run app`, never documented in
  // the README) — V2-T75 PO review (round 3), item 4's own capture: proving a project shows
  // `openHere` (`matchingTabId`, `sidebar/session-match.ts`'s own "by pid, and only by pid")
  // needs a discovered session whose `pid` equals a REAL tab's pid, and the fixture used for
  // every other V2-T75 screenshot has no way to predict that pid in advance (the OS assigns
  // it at spawn time). Writing it out here, for a verification run to read and fold back into
  // its own fixture session file before the ambient tick after this one, is simpler and more
  // reliable than guessing at it from the OS process tree externally.
  const tabPidPath = process.env.SEEYA_APP_VERIFICATION_TAB_PID_PATH;
  if (tabPidPath !== undefined) {
    await writeFile(tabPidPath, String(pid), 'utf8');
  }
}

/**
 * SEEYA_APP_VERIFICATION_RESIZE_LOG_PATH: called by `CHANNELS.resizeTab`'s handler after it
 * resized the pty. A no-op when the variable is unset.
 */
export function recordResizeForVerification(clock: Clock, request: ResizeTabRequest): void {
  // SEEYA_APP_VERIFICATION_RESIZE_LOG_PATH: same "instrumentação só do spike" class as every
  // other `SEEYA_APP_*` flag this file reads (never set by `npm run app`) — V2-T75-terminal-
  // resize's own before/after proof: one line per `resize-tab` this process ever sends to a
  // pty, so a verification run can show the exact sequence (absurd cols/rows mid-transition
  // before the fix; none while hidden, one correct resize on return, after it).
  const resizeLogPath = process.env.SEEYA_APP_VERIFICATION_RESIZE_LOG_PATH;
  if (resizeLogPath !== undefined) {
    const line = `${clock.now().toISOString()} id=${request.id} cols=${request.cols} rows=${request.rows}\n`;
    void appendFile(resizeLogPath, line);
  }
}
