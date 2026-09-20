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
import type { CwdHistoryEntry } from '@seeya-ai/engine/application/cwd-history.js';
import type { Day, Handoff } from '@seeya-ai/engine/core/types.js';
import { MESSAGES } from '../text/messages.js';
import type { LiveSessionInfo } from '../sidebar/sidebar-data.js';

/**
 * V2-T9 item 4 — replaces `alreadyResumed: boolean`. A discriminated union (D-024), not a flag,
 * because the panel's checkbox rule now depends on TWO independent facts (is it running right
 * now, was it ever resumed) that a single boolean can't tell apart:
 *
 * - `runningNow` — the discovery this same refresh cycle already did found this session alive or
 *   idle (`core/classification.ts`: both mean the process is running), in a tab or a bare
 *   terminal. Blocks the checkbox; `matchedTabId` is the tab it corresponds to in THIS window, if
 *   any (D-025: `null` when there's no correspondence, never a guess).
 * - `resumedEarlier` — not running now, but `resumed.json` says it was resumed at some point
 *   today. The checkbox comes back — the achado this item exists to fix: a session resumed this
 *   morning and then closed (app restarted, tab closed by hand) must be offerable again, and
 *   `resumed.json` alone can't tell "resumed" from "resumed and then closed" apart.
 * - `neverResumed` — today's default: offer the checkbox, nothing to say about it yet.
 */
export type TodayResumeStatus =
  | { readonly kind: 'runningNow'; readonly matchedTabId: string | null }
  | { readonly kind: 'resumedEarlier' }
  | { readonly kind: 'neverResumed' };

/**
 * V2-T18 — the ONE decision `electron/renderer.ts#renderTodaySessionRow` needs to pick a DOM
 * shape (D-041: the renderer holds no decision of its own): every status except `runningNow`
 * offers the checkbox. Kept here, not inline in the renderer, so it's unit-tested — the bug this
 * function fixes had the renderer's own branching group `resumedEarlier` with `runningNow`,
 * losing the checkbox for a session already resumed once today and then closed (the achado V2-T9
 * item 4 existed to fix, undone by that branching).
 *
 * @example
 * offersResumeCheckbox({ kind: 'resumedEarlier' }); // true — the checkbox comes back
 * offersResumeCheckbox({ kind: 'runningNow', matchedTabId: null }); // false — nothing to resume
 */
export function offersResumeCheckbox(status: TodayResumeStatus): boolean {
  return status.kind !== 'runningNow';
}

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
  readonly resumeStatus: TodayResumeStatus;
  /**
   * V2-T9 item 1/2 — this session's directory history, oldest run first, from
   * `application/cwd-history.ts#readCwdHistory`. Always at least the current day's own entry for a
   * session that reached this row at all (it came from a real handoff); `length <= 1` means no
   * change was ever observed, which is "no note" (D-025: absence of a change is never itself
   * asserted — the panel just has nothing extra worth saying).
   */
  readonly cwdHistory: readonly CwdHistoryEntry[];
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

/** V2-T9 item 4's own rule, in one place: "viva" (in `liveSessionIds`) always wins over
 * `resumed.json` — a session can be alive right now without `resumed.json` ever having heard of
 * it (resumed by hand from a bare terminal, which the daemon's own discovery still sees), and
 * that has to block the checkbox exactly the same as one the panel itself resumed. */
function resolveResumeStatus(
  sessionId: string,
  resumedSessionIds: ReadonlySet<string>,
  liveSessionIds: ReadonlyMap<string, LiveSessionInfo>,
): TodayResumeStatus {
  const live = liveSessionIds.get(sessionId);
  if (live !== undefined) {
    return { kind: 'runningNow', matchedTabId: live.matchedTabId };
  }
  return resumedSessionIds.has(sessionId) ? { kind: 'resumedEarlier' } : { kind: 'neverResumed' };
}

function buildRow(
  handoff: Handoff,
  resumedSessionIds: ReadonlySet<string>,
  cwdHistoryBySessionId: ReadonlyMap<string, readonly CwdHistoryEntry[]>,
  liveSessionIds: ReadonlyMap<string, LiveSessionInfo>,
): TodaySessionRow {
  return {
    sessionId: handoff.sessionId,
    name: handoff.name,
    cwd: handoff.cwd,
    firstPlanLine: firstPlanLine(handoff),
    resumeStatus: resolveResumeStatus(handoff.sessionId, resumedSessionIds, liveSessionIds),
    // Defensive fallback (D-025): every real caller computes one entry per handoff in the
    // briefing (`electron/main.ts`'s own `getTodayPanel` handler), so this only ever triggers in
    // a test that hands in a partial map on purpose — an empty history is "no note", never an
    // invented one.
    cwdHistory: cwdHistoryBySessionId.get(handoff.sessionId) ?? [],
  };
}

/**
 * @example
 * const lookup = await findPendingBriefing(storage, clock, config.maxBriefingScanDays);
 * const panel = buildTodayPanelData(lookup, cwdHistoryBySessionId, liveSessionIds);
 * // panel.kind === 'pending' ? panel.rows : panel.message
 */
export function buildTodayPanelData(
  lookup: PendingBriefingLookup,
  cwdHistoryBySessionId: ReadonlyMap<string, readonly CwdHistoryEntry[]> = new Map(),
  liveSessionIds: ReadonlyMap<string, LiveSessionInfo> = new Map(),
): TodayPanelData {
  if (!lookup.found) {
    return { kind: 'noBriefing', message: MESSAGES.todayNoBriefing(lookup.daysSearched) };
  }
  return {
    kind: 'pending',
    day: lookup.briefing.day,
    daysAgo: lookup.daysAgo,
    rows: lookup.briefing.handoffs.map((handoff) =>
      buildRow(handoff, lookup.resumedSessionIds, cwdHistoryBySessionId, liveSessionIds),
    ),
  };
}

/**
 * V2-T18 item 2 — the two inputs to `buildTodayPanelData` that DON'T change on every refresh
 * tick: `lookup` (`findPendingBriefing`, a storage scan) and `cwdHistoryBySessionId`
 * (`readCwdHistory` per handoff, more storage scans). `electron/main.ts`'s own `getTodayPanel`
 * handler caches these the moment it builds them; `refreshTodayPanelLiveness` below is what the
 * ambient refresh loop calls every tick instead, so the panel tracks liveness without repeating
 * that I/O ten times a minute.
 */
export interface TodayPanelInputs {
  readonly lookup: PendingBriefingLookup;
  readonly cwdHistoryBySessionId: ReadonlyMap<string, readonly CwdHistoryEntry[]>;
}

/**
 * V2-T18 item 2 — recomputes the "Today" panel with FRESH liveness only, reusing `inputs` from
 * the last full build untouched. `liveSessionIds` is the SAME discovery the refresh loop's own
 * tick already did for the sidebar (`sidebar/sidebar-data.ts#buildLiveSessionIndex`), never a
 * second `SessionProvider.list()` call — the plan entry's own "reusando a MESMA descoberta do
 * ciclo". Returns `null` when nothing has been built yet (the window hasn't called
 * `getTodayPanel` for the first time, so there is no `lookup` to recompute from) — D-025: never a
 * fabricated empty panel, `electron/main.ts`'s own tick simply skips the push that tick.
 *
 * @example
 * const data = refreshTodayPanelLiveness(latestTodayPanelInputs, buildLiveSessionIndex(rows));
 * if (data !== null) window.webContents.send(CHANNELS.todayUpdate, data);
 */
export function refreshTodayPanelLiveness(
  inputs: TodayPanelInputs | null,
  liveSessionIds: ReadonlyMap<string, LiveSessionInfo>,
): TodayPanelData | null {
  if (inputs === null) {
    return null;
  }
  return buildTodayPanelData(inputs.lookup, inputs.cwdHistoryBySessionId, liveSessionIds);
}
