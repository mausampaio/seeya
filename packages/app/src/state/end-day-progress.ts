/**
 * V2-T5a item 3/4 — projects `application/end-day.ts`'s own `CaptureProgressEvent` (the engine's
 * `onCaptureProgress` hook) into the IPC-safe shape `electron/main.ts` sends over
 * `CHANNELS.endDayProgress` while "Run end-day now" is in flight. Pure: no I/O, no Electron —
 * pulled into its own module rather than inlined in `main.ts#resumeSelected`'s style (that handler
 * projects `ResumeProgressEvent` inline) because this task's own cuidado asks explicitly for "a
 * projeção do progresso" to be tested outside `electron/`.
 *
 * `null` for `captureFinished`: the panel's own progress line only ever shows which session is
 * CURRENTLY being captured (docs/PLANO-DE-ENTREGA.md V2-T5a: "a interface mostra 'capturing 2 of
 * 5: <nome>'"), not a second line per finished session — the final outcome (captured, ineligible,
 * or failed and why) for every session is already in the literal report text the dialog shows once
 * the whole run ends (`formatEndDayReport`), so repeating it here per session would just say the
 * same fact twice, once early and once (correctly) in the final report.
 */
import type { CaptureProgressEvent } from '@seeya-ai/engine/application/types.js';
import type { EndDayProgressUpdateEvent } from '../ipc/channels.js';

/**
 * @example
 * onCaptureProgress: (event) => {
 *   const projected = projectEndDayProgressEvent(event);
 *   if (projected !== null) window.webContents.send(CHANNELS.endDayProgress, projected);
 * }
 */
export function projectEndDayProgressEvent(
  event: CaptureProgressEvent,
): EndDayProgressUpdateEvent | null {
  if (event.kind !== 'captureStarted') {
    return null;
  }
  return { index: event.index, total: event.total, name: event.session.name };
}
