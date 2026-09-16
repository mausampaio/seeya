/**
 * Builds the app's own `FallbackConfirmer` (V2-T4 item 3, `application/start-day.ts`'s injected
 * callback) — a diálogo in the window instead of the CLI's `readline` question, same S5-T9
 * decision (D-025: "warn BEFORE, and ask") behind both. Pure given `pending`/`send`: no Electron
 * here, `electron/main.ts` supplies `send` as a thin wrapper over `window.webContents.send` and
 * registers the matching `ipcMain.on(CHANNELS.confirmFallbackAnswer, ...)` handler that calls
 * `pending.resolve(...)`.
 */
import { describeFallbackReason } from '@seeya-ai/engine/core/resume-notice.js';
import type { FallbackConfirmer } from '@seeya-ai/engine/application/start-day.js';
import type { Handoff, ResumeFallbackReason } from '@seeya-ai/engine/core/types.js';
import type { FallbackConfirmRequestEvent } from '../ipc/channels.js';
import {
  PendingFallbackRequests,
  type FallbackDialogDecision,
} from './pending-fallback-requests.js';

/** The one piece of real I/O this module needs but never does itself — `electron/main.ts` wires
 * this to `window.webContents.send(CHANNELS.confirmFallbackRequest, request)`. */
export type SendFallbackRequest = (request: FallbackConfirmRequestEvent) => void;

/**
 * @example
 * const pending = new PendingFallbackRequests();
 * const confirmFallback = buildFallbackConfirmer(pending, (request) =>
 *   window.webContents.send(CHANNELS.confirmFallbackRequest, request),
 * );
 * // ipcMain.on(CHANNELS.confirmFallbackAnswer, (_e, answer) => pending.resolve(answer.requestId, answer.decision))
 */
export function buildFallbackConfirmer(
  pending: PendingFallbackRequests,
  send: SendFallbackRequest,
): FallbackConfirmer {
  return async (handoff: Handoff, reason: ResumeFallbackReason) => {
    const { requestId, answer } = pending.create();
    send({
      requestId,
      sessionName: handoff.name,
      cwd: handoff.cwd,
      reasonText: describeFallbackReason(reason),
    });
    const decision: FallbackDialogDecision = await answer;
    return decision === 'open' ? { kind: 'open' } : { kind: 'skip' };
  };
}
