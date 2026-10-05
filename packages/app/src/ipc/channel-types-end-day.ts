/**
 * Payload shapes of the End day dialog channels (V2-T51: split out of `ipc/channels.ts`, which still re-exports every
 * one of them, so no importer changed). Pure types — no `electron` import.
 */
import type {
  EndDayNotCapturedRow,
  EndDayReasonRow,
  EndDaySessionSummaryRow,
} from '../state/end-day-sessions.js';

/** `CHANNELS.endDayPreview`'s response (V2-T5a item 1, reworked by V2-T69 into structured rows —
 * no more `reportText`, `docs/INTERFACE.md` principle 5). `willBeCaptured`/`notCaptured` are
 * `state/end-day-sessions.ts#buildEndDayPreviewRows`'s own output for a `dryRun: true` run — the
 * SAME `EndDayResult` `seeya end-day --dry-run`'s own `formatEndDayReport` reads, just shaped for a
 * list instead of a paragraph. `costCeiling` is `state/end-day-preview.ts#EndDayCostCeiling`,
 * re-declared here rather than imported (same "ipc/channels.ts is pure, no engine-adjacent app
 * module imports it back" shape `ResumeSummaryResponse` above already has for its own list
 * entries) — unlike the row types above, which DO import from `state/`, since this shape has no
 * engine type underneath it to keep this module decoupled from. */
export interface EndDayPreviewResponse {
  readonly willBeCaptured: readonly EndDaySessionSummaryRow[];
  readonly notCaptured: readonly EndDayNotCapturedRow[];
  readonly costCeiling: {
    readonly sessionsInScope: number;
    readonly budgetPerSessionUsd: number;
    readonly captureModel: string;
    readonly totalCeilingUsd: number;
  };
}

/** `CHANNELS.endDayRun`'s response (V2-T5a item 4, reworked by V2-T69) — the real run's own three
 * final buckets (`state/end-day-sessions.ts#buildEndDayResultRows`), same `EndDayResult`
 * `seeya end-day`'s own `formatEndDayReport` reads. */
export interface EndDayRunResponse {
  readonly captured: readonly EndDaySessionSummaryRow[];
  readonly failed: readonly EndDayReasonRow[];
  readonly skipped: readonly EndDayReasonRow[];
}

/** `CHANNELS.endDayProgress`'s payload (V2-T69) — both `CaptureProgressEvent` kinds now cross the
 * IPC boundary, keyed by `sessionId` (never just `name`, which two sessions could share), so
 * `state/end-day-panel.ts#reduceEndDayPanel` can update the right row in the running view's own
 * per-session list — see `state/end-day-progress.ts`'s own docstring for why `captureFinished` is
 * forwarded now when V2-T5a deliberately dropped it. */
export type EndDayProgressUpdateEvent =
  | {
      readonly kind: 'started';
      readonly sessionId: string;
      readonly name: string;
      readonly index: number;
      readonly total: number;
    }
  | {
      readonly kind: 'finished';
      readonly sessionId: string;
      readonly outcome: 'captured' | 'ineligible' | 'failed';
    };
