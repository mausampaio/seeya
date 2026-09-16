/**
 * V2-T5a item 1 — the "End day…" preview's own cost-ceiling figure (D-025: honest, never an
 * estimate — this is the ceiling `application/capture-session.ts`'s own `--max-budget-usd` already
 * enforces per session capture, just multiplied out here for display). Pure: no I/O.
 * `electron/main.ts` builds `sessionsInScope` from the SAME dry-run `EndDayResult`
 * (`result.sessionsInScope`) the preview's own report text (`formatEndDayReport`) already reads,
 * and `budgetPerSessionUsd`/`captureModel` straight from `Config` — never a second, independent
 * count of sessions that could drift from what the report text says.
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
 * const ceiling = buildEndDayCostCeiling(preview.sessionsInScope, config.budgetPerSessionUsd, config.captureModel);
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
