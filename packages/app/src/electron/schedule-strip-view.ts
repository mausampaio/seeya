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
  const snoozeMenu = document.getElementById('schedule-strip-snooze') as HTMLSelectElement;
  const skip = document.getElementById('schedule-strip-skip') as HTMLButtonElement;
  snoozeMenu.hidden = !data.canSnooze;
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

/** V2-T63: the three increments as a native `<select>` (`docs/INTERFACE.md` § 1's own "menu") —
 * `app-shell.tsx` builds the placeholder option statically; this only fills the three real ones,
 * mirroring D-006's fixed set. */
function populateSnoozeMenu(menu: HTMLSelectElement): void {
  const options: readonly [string, string][] = [
    ['15', MESSAGES.scheduleStripSnooze15],
    ['30', MESSAGES.scheduleStripSnooze30],
    ['60', MESSAGES.scheduleStripSnooze1h],
  ];
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    menu.appendChild(option);
  }
}

/** Wired once, at startup — also wires `onScheduleUpdate`, the schedule-specific slice of what
 * used to be `wireIncomingEvents`. */
export function wireScheduleStrip(): void {
  const snoozeMenu = document.getElementById('schedule-strip-snooze') as HTMLSelectElement;
  const skip = document.getElementById('schedule-strip-skip') as HTMLButtonElement;
  populateSnoozeMenu(snoozeMenu);
  skip.textContent = MESSAGES.scheduleStripSkipToday;
  snoozeMenu.addEventListener('change', () => {
    const minutes = Number(snoozeMenu.value);
    // Resets to the placeholder right away — the menu reports an increment chosen, it never
    // keeps showing "+15m" as if that were now a persistent state of its own (the pill above is
    // what shows persistent state; this is a one-shot action).
    snoozeMenu.value = '';
    if (minutes === 15 || minutes === 30 || minutes === 60) {
      void handleScheduleAdjustment(minutes);
    }
  });
  skip.addEventListener('click', () => void handleScheduleAdjustment(null));
  window.seeya.onScheduleUpdate((event) => renderScheduleStrip(event));
}
