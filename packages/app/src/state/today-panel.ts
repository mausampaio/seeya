/**
 * V2-T4 item 1 — the "Today" panel's own view-model, built from `application/find-pending-briefing.js`'s
 * result the exact same way `seeya start-day` reads it (`findPendingBriefing`, `PendingBriefingLookup`):
 * the most recent day whose briefing still has unresumed, content-pending work. Pure — no I/O, no
 * Electron — `electron/main.ts` calls `findPendingBriefing` (real `Storage`/`Clock`) and hands the
 * result here; this module only decides what to show.
 *
 * **Not `unresumedHandoffs` (`core/pending-briefing.js`).** That function narrows to "candidates a
 * picker should offer" — this module needs every handoff in the briefing, including ones already
 * resumed today, so the panel can say so (D-024/D-025: "quais já foram retomadas" is itself
 * something the person needs to see, not something to quietly drop from the list).
 *
 * **Nothing here moved out of `packages/cli/src`.** V2-T4's own criterion (mirroring V2-T2's) is
 * that only pure selection logic the CLI and the interface would otherwise duplicate moves to
 * `application/`. The CLI's own picker (`start-day-selection.ts`) never extracts a first plan line
 * — that's new, interface-only presentation this task introduces — so there is no CLI code to move.
 */
import type { PendingBriefingLookup } from '@seeya-ai/engine/application/find-pending-briefing.js';
import type { Day, Handoff } from '@seeya-ai/engine/core/types.js';
import { MESSAGES } from '../text/messages.js';

export interface TodaySessionRow {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
  /**
   * The first line of the plan a person would read before deciding to resume — `null` when there
   * is genuinely nothing to show (D-025): a non-`model` handoff never had the model produce a
   * plan at all, and a `model` handoff can legitimately report neither `tomorrowPlan` nor
   * `pendingItems` (nothing left to do). Never a fabricated placeholder string.
   */
  readonly firstPlanLine: string | null;
  /** `Storage.readResumedSessionIds(day)` already told `findPendingBriefing` this — carried
   * through so the panel can say "already resumed today" instead of offering a checkbox for it. */
  readonly alreadyResumed: boolean;
}

export type TodayPanelData =
  | { readonly kind: 'noBriefing'; readonly message: string }
  | {
      readonly kind: 'pending';
      readonly day: Day;
      readonly daysAgo: number;
      readonly rows: readonly TodaySessionRow[];
    };

/** A `model` handoff's own first plan line — `tomorrowPlan` before `pendingItems` (a session with
 * both TELLS you what's next before it tells you what's unfinished), or `null` when a `model`
 * handoff reported neither (D-025: an empty verdict is not a missing one, but there is still
 * nothing to show as a "first line"). A non-`model` handoff never had a plan generated at all —
 * `null` for the same D-025 reason `core/consolidated-plan.ts#renderSessionPlanLine` already
 * applies to that case. */
function firstPlanLine(handoff: Handoff): string | null {
  if (handoff.source !== 'model') {
    return null;
  }
  return handoff.tomorrowPlan[0] ?? handoff.pendingItems[0] ?? null;
}

function buildRow(handoff: Handoff, resumedSessionIds: ReadonlySet<string>): TodaySessionRow {
  return {
    sessionId: handoff.sessionId,
    name: handoff.name,
    cwd: handoff.cwd,
    firstPlanLine: firstPlanLine(handoff),
    alreadyResumed: resumedSessionIds.has(handoff.sessionId),
  };
}

/**
 * @example
 * const lookup = await findPendingBriefing(storage, clock, config.maxBriefingScanDays);
 * const panel = buildTodayPanelData(lookup);
 * // panel.kind === 'pending' ? panel.rows : panel.message
 */
export function buildTodayPanelData(lookup: PendingBriefingLookup): TodayPanelData {
  if (!lookup.found) {
    return { kind: 'noBriefing', message: MESSAGES.todayNoBriefing(lookup.daysSearched) };
  }
  return {
    kind: 'pending',
    day: lookup.briefing.day,
    daysAgo: lookup.daysAgo,
    rows: lookup.briefing.handoffs.map((handoff) => buildRow(handoff, lookup.resumedSessionIds)),
  };
}
