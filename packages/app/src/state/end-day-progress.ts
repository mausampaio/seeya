/**
 * V2-T69: projects `application/end-day.ts`'s own `CaptureProgressEvent` (the engine's
 * `onCaptureProgress` hook) into the IPC-safe shape `electron/main.ts` sends over
 * `CHANNELS.endDayProgress` while "Run end-day now" is in flight. Pure: no I/O, no Electron.
 *
 * **Both `captureStarted` and `captureFinished` now cross the IPC boundary — a change from V2-T5a
 * (D-024).** That task deliberately dropped `captureFinished` because the panel back then only
 * ever showed ONE line ("capturing N of M: name") and the final report already said what happened
 * to every session once the whole run ended. V2-T69's own per-session status list
 * (`docs/INTERFACE.md` § 6: "lista com o estado de cada sessão — captured/capturing/waiting")
 * needs to know the moment EACH session's own outcome lands, not just the headline's current name —
 * so both events are forwarded, carrying `sessionId` (never just `name`, which two sessions could
 * share) so `state/end-day-panel.ts#reduceEndDayPanel` can update the right row.
 */
import type { CaptureProgressEvent } from '@seeya-ai/engine/application/types.js';
import type { EndDayProgressUpdateEvent } from '../ipc/channels.js';

/**
 * @example
 * onCaptureProgress: (event) => {
 *   window.webContents.send(CHANNELS.endDayProgress, projectEndDayProgressEvent(event));
 * }
 */
export function projectEndDayProgressEvent(event: CaptureProgressEvent): EndDayProgressUpdateEvent {
  if (event.kind === 'captureStarted') {
    return {
      kind: 'started',
      sessionId: event.session.sessionId,
      name: event.session.name,
      index: event.index,
      total: event.total,
    };
  }
  return {
    kind: 'finished',
    sessionId: event.session.sessionId,
    outcome: event.outcome.kind,
  };
}
