/**
 * V2-T5a item 1 — the "End day…" preview's own cost-ceiling figure (D-025: honest, never an
 * estimate — this is the ceiling `application/capture-session.ts`'s own `--max-budget-usd` already
 * enforces per session capture, just multiplied out here for display). Pure: no I/O.
 * `budgetPerSessionUsd`/`captureModel` come straight from `Config`.
 *
 * **PO review round 2 (V2-T69, item 1): `sessionsInScope` is `willBeCaptured.length`, never the
 * engine's own `EndDayResult.sessionsInScope`.** The two used to differ: the engine's count also
 * includes cheap-ineligible sessions (never reach generation at all) and genuine `CaptureFailure`s
 * (which ALSO never reach generation — a `CaptureFailure` can only arise from `gatherEvidence`/
 * eligibility-assembly I/O, since a generator failure is swallowed into a `deterministic` handoff
 * instead, never a `CaptureFailure`, `application/end-day.ts#captureSessionOutcome`). Counting
 * either toward "how much could this cost" overstated the ceiling past what could ever actually be
 * spent — `electron/main.ts`'s own `endDayPreview` handler passes `willBeCaptured.length` from the
 * SAME `buildEndDayPreviewRows(result, ...)` call, the identical collection
 * `state/end-day-panel.ts#seedTrackedSessions` also seeds its own running-view `total` from, so the
 * cost ceiling, "Will be captured"'s own heading count, and the running view's own "i of M" are
 * now the SAME number by construction, never three independent counts that could drift apart.
 *
 * **Review fix: the ceiling below describes what RUNNING would cost, never what the preview
 * itself cost.** `main.ts#endDayPreview`'s own `endDay` call passes `skipGeneration: true`
 * (`EndDayOptions`), so fetching this figure never calls the model at all — `text/messages.ts
 * #endDayCostCeiling` says so explicitly in the line this figure feeds.
 */
import type { Config } from '@seeya-ai/engine/core/types.js';

export interface EndDayCostCeiling {
  readonly sessionsInScope: number;
  readonly budgetPerSessionUsd: number;
  readonly captureModel: string;
  /** `sessionsInScope * budgetPerSessionUsd` — a ceiling, not a prediction: a real run may spend
   * less per session (or nothing, for a session that turns out ineligible between the preview and
   * the real run), never more than this per session (D-025). */
  readonly totalCeilingUsd: number;
}

/**
 * @example
 * const ceiling = buildEndDayCostCeiling(preview.willBeCaptured.length, config);
 * // ceiling.totalCeilingUsd === ceiling.sessionsInScope * ceiling.budgetPerSessionUsd
 */
export function buildEndDayCostCeiling(
  sessionsInScope: number,
  config: Pick<Config, 'budgetPerSessionUsd' | 'captureModel'>,
): EndDayCostCeiling {
  return {
    sessionsInScope,
    budgetPerSessionUsd: config.budgetPerSessionUsd,
    captureModel: config.captureModel,
    totalCeilingUsd: sessionsInScope * config.budgetPerSessionUsd,
  };
}
