/**
 * The faixa de horário (V2-T5b item 1 — split out of the former single-file `renderer.ts` by
 * V2-T62/D-051). Excluded from `packages/app/src`'s coverage floor with everything else in
 * `electron/` (it cannot run without a display).
 */
import { MESSAGES } from '../text/messages.js';
import type { ScheduleUpdateEvent } from '../ipc/channels.js';

/**
 * V2-T5b item 1: renders the faixa de horário from whatever `buildScheduleStripData` last
 * produced — called after every `onScheduleUpdate` push (the ambient refresh tick) and again,
 * immediately, after a Snooze/Skip click resolves (`handleScheduleAdjustment` below), so the
 * faixa never waits up to `REFRESH_INTERVAL_MS` to reflect what the person just clicked.
 */
export function renderScheduleStrip(data: ScheduleUpdateEvent): void {
  (document.getElementById('schedule-strip-text') as HTMLElement).textContent = data.text;
  const snooze15 = document.getElementById('schedule-strip-snooze-15') as HTMLButtonElement;
  const snooze30 = document.getElementById('schedule-strip-snooze-30') as HTMLButtonElement;
  const snooze1h = document.getElementById('schedule-strip-snooze-1h') as HTMLButtonElement;
  const skip = document.getElementById('schedule-strip-skip') as HTMLButtonElement;
  snooze15.hidden = !data.canSnooze;
  snooze30.hidden = !data.canSnooze;
  snooze1h.hidden = !data.canSnooze;
  skip.hidden = !data.canSkip;
}

/** One click handler for all three Snooze buttons and "Skip today" — `request` is `null` for
 * skip, one of D-006's three increments otherwise. Both IPC calls return the freshly recomputed
 * strip (`main.ts`'s own handler docstring), rendered immediately rather than waiting for the
 * next ambient `onScheduleUpdate` tick. */
async function handleScheduleAdjustment(minutes: 15 | 30 | 60 | null): Promise<void> {
  const updated =
    minutes === null ? await window.seeya.skipToday() : await window.seeya.snoozeToday({ minutes });
  renderScheduleStrip(updated);
}

/** Wired once, at startup — also wires `onScheduleUpdate`, the schedule-specific slice of what
 * used to be `wireIncomingEvents`. */
export function wireScheduleStrip(): void {
  const snooze15 = document.getElementById('schedule-strip-snooze-15') as HTMLButtonElement;
  const snooze30 = document.getElementById('schedule-strip-snooze-30') as HTMLButtonElement;
  const snooze1h = document.getElementById('schedule-strip-snooze-1h') as HTMLButtonElement;
  const skip = document.getElementById('schedule-strip-skip') as HTMLButtonElement;
  snooze15.textContent = MESSAGES.scheduleStripSnooze15;
  snooze30.textContent = MESSAGES.scheduleStripSnooze30;
  snooze1h.textContent = MESSAGES.scheduleStripSnooze1h;
  skip.textContent = MESSAGES.scheduleStripSkipToday;
  snooze15.addEventListener('click', () => void handleScheduleAdjustment(15));
  snooze30.addEventListener('click', () => void handleScheduleAdjustment(30));
  snooze1h.addEventListener('click', () => void handleScheduleAdjustment(60));
  skip.addEventListener('click', () => void handleScheduleAdjustment(null));
  window.seeya.onScheduleUpdate((event) => renderScheduleStrip(event));
}
