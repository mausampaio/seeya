/**
 * The faixa de horário IPC (V2-T5b, V2-T50, V2-T75; V2-T51: moved out of `main/main.ts`) — the
 * shared `computeScheduleEvent` plus the snooze/skip/undo handlers and the first-paint fetch.
 */
import { ipcMain } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  ScheduleUpdateEvent,
  ScheduleStripResponse,
  SnoozeTodayRequest,
} from '../ipc/channels.js';
import { decideSchedule, decideUndoSnooze, emptyDayState } from '@seeya-ai/engine/core/schedule.js';
import { localDayString } from '@seeya-ai/engine/core/day.js';
import type { Config } from '@seeya-ai/engine/core/types.js';
import { type AppContext } from '../composition/index.js';
import { buildScheduleStripData } from '../state/schedule-strip.js';
import { snoozeTodayNow, skipTodayNow, undoSnoozeTodayNow } from '../state/schedule-actions.js';
import { holdForVerification } from './verification/index.js';

/**
 * The faixa de horário's own data — shared by `CHANNELS.getScheduleStrip`'s own handler, the
 * ambient tick's own `scheduleUpdate` push, and `saveSetting`'s own immediate recompute (V2-T75 PO
 * review, round 3: these three call sites used to each run the same `decideSchedule` call inline,
 * which is exactly the duplication AGENTS.md's "nada de duplicação" rules out). `config` is
 * accepted already-resolved so a caller that just read or wrote it (the ambient tick, `saveSetting`)
 * never pays for a second `readConfig()` — `getScheduleStrip`'s own handler is the only caller that
 * has to read it itself.
 */
export async function computeScheduleEvent(
  context: Pick<AppContext, 'storage' | 'clock'>,
  config: Config,
): Promise<ScheduleUpdateEvent> {
  const now = context.clock.now();
  const today = localDayString(now);
  const dayState = (await context.storage.readState()) ?? emptyDayState(today);
  const { decision } = decideSchedule(config, dayState, now);
  return buildScheduleStripData(decision, now, decideUndoSnooze(config, dayState, now));
}

export function wireScheduleIpc(context: AppContext): void {
  // V2-T5b item 1: "Snooze +15m/+30m/+1h" / "Skip today" — both run the SAME orchestration
  // `application/schedule-adjustments.js` gives the CLI's own `snooze`/`skip-today` commands
  // (item 2), and return the freshly recomputed strip so the faixa updates immediately instead of
  // waiting for the next ambient `onTick` below (which will also reflect it, harmlessly, at most
  // REFRESH_INTERVAL_MS later).
  //
  // V2-T16: `snoozeTodayNow`/`skipTodayNow` (`state/schedule-actions.ts`) read `config.json`
  // fresh themselves — this used to pass `context.config` (a snapshot from window startup)
  // straight through, which is the bug this task fixes; see that module's own docstring.
  ipcMain.handle(
    CHANNELS.snoozeToday,
    async (_event, request: SnoozeTodayRequest): Promise<ScheduleUpdateEvent> =>
      snoozeTodayNow(context.storage, context.clock, request.minutes),
  );

  ipcMain.handle(CHANNELS.skipToday, async (): Promise<ScheduleUpdateEvent> => {
    const result = await skipTodayNow(context.storage, context.clock);
    // SEEYA_APP_VERIFY_HOLD_SKIP_MS (V2-T79): see `holdForVerification`'s own docstring — a no-op
    // outside a verification run, so the real button's own latency is exactly what it always was.
    await holdForVerification(context.clock);
    return result;
  });

  // V2-T50: the Snooze menu's "Undo snooze" — same immediate-update shape as the two above.
  ipcMain.handle(CHANNELS.undoSnoozeToday, async (): Promise<ScheduleUpdateEvent> =>
    undoSnoozeTodayNow(context.storage, context.clock),
  );

  // V2-T75 PO review (round 3): fetched once at startup — see `CHANNELS.getScheduleStrip`'s own
  // docstring (the invoke-discard production defect this fixes).
  ipcMain.handle(CHANNELS.getScheduleStrip, async (): Promise<ScheduleStripResponse> => {
    const config = await context.storage.readConfig();
    return computeScheduleEvent(context, config);
  });
}
