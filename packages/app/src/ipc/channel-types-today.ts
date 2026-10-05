/**
 * Payload shapes of the Today panel, "Resume selected" and the fallback dialog channels (V2-T51: split out of `ipc/channels.ts`, which still re-exports every
 * one of them, so no importer changed). Pure types — no `electron` import.
 */
import type { TodayPanelData } from '../state/today-panel.js';

/** `CHANNELS.confirmFallbackRequest`'s payload — the exact shape
 * `resume/fallback-confirmer.ts#FallbackConfirmRequestPayload` produces (re-declared here rather
 * than imported, same "ipc/channels.ts is pure, no engine-adjacent app module imports it back"
 * shape every other event type in this file already has — `resume/` imports FROM `ipc/`, never
 * the other way). */
export interface FallbackConfirmRequestEvent {
  readonly requestId: string;
  readonly sessionName: string;
  readonly cwd: string;
  readonly reasonText: string;
  /** V2-T7 item 4: whether the dialog should offer "Resume without the plan" at all — `true` only
   * for a `promptTooLarge` reason (`resume/fallback-confirmer.ts#buildFallbackConfirmer`'s own
   * computation, never re-derived in `renderer.ts`, D-041). `false` for `resumeFailed`: that
   * reason has no free option to fall back to (`core/resume-fallback-decision.ts`'s own
   * docstring). */
  readonly offersResumeWithoutPlan: boolean;
}

/** `CHANNELS.confirmFallbackAnswer`'s payload. `'resumeWithoutPlan'` (V2-T7) is only ever sent for
 * a request whose `offersResumeWithoutPlan` was `true` — `renderer.ts#wireFallbackDialog` hides
 * that button otherwise. */
export interface FallbackConfirmAnswerRequest {
  readonly requestId: string;
  readonly decision: 'open' | 'resumeWithoutPlan' | 'skip';
}

/** `CHANNELS.getTodayPanel`'s response — the exact shape `state/today-panel.ts#buildTodayPanelData`
 * produces. */
export type TodayPanelResponse = TodayPanelData;

/** `CHANNELS.todayUpdate`'s payload (V2-T18 item 2) — the exact same shape as
 * `TodayPanelResponse`, just pushed instead of fetched. */
export type TodayUpdateEvent = TodayPanelData;

/** `CHANNELS.resumeSelected`'s payload. `day` is `core/types.ts`'s `Day` (a plain string,
 * `YYYY-MM-DD`) — not imported from the engine here, same "this file only ever imports app-internal
 * state modules" shape every other type above already keeps (`SidebarRow`/`TerminalFontOptions`/
 * `TodayPanelData`). */
export interface ResumeSelectedRequest {
  readonly day: string;
  readonly sessionIds: readonly string[];
  /**
   * V2-T9 item 2 — the directory chosen in the "Resume in" selector, keyed by `sessionId`, for a
   * session whose row offered one (`state/today-panel.ts#TodaySessionRow.cwdHistory`, more than
   * one directory). A `sessionId` with no entry here had no selector to choose from at all (a
   * single-directory history) — `electron/main.ts`'s own handler falls back to the handoff's own
   * `cwd` for those (D-025: never an invented choice where the interface never offered one). The
   * choice only ever affects THIS resume attempt; nothing is rewritten to disk.
   */
  readonly chosenCwdBySessionId: Readonly<Record<string, string>>;
}

/** One session, named for display — the common shape every `ResumeSummaryResponse` list entry
 * below builds on. */
export interface ResumeSummarySession {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
}

/** The three `ResumeOutcome` forms (V2-T7, `core/types.ts#ResumeOutcome`'s own docstring),
 * projected for display: `'resumed'` needs no extra text; `'resumedWithoutPlan'`/`'freshSession'`
 * carry the same wording `core/resume-notice.ts#formatResumeNotice` gives the CLI's own summary —
 * computed once, in `state/resume-summary.ts`, never re-derived from the raw `ResumeOutcome` in
 * `electron/renderer.ts` (which has no logic of its own, D-041). A discriminated union rather than
 * a boolean-shaped `fellBack` (D-024, mirroring the engine type it projects). */
export type ResumeSummaryOutcome =
  | (ResumeSummarySession & { readonly kind: 'resumed' })
  | (ResumeSummarySession & { readonly kind: 'resumedWithoutPlan'; readonly noteText: string })
  | (ResumeSummarySession & { readonly kind: 'freshSession'; readonly noteText: string });

export interface ResumeSummarySkipped extends ResumeSummarySession {
  /** The exact same wording `core/resume-notice.ts#describeFallbackReason` gives the CLI. */
  readonly reasonText: string;
}

export interface ResumeSummaryInvalid extends ResumeSummarySession {
  readonly reason: string;
}

/** `CHANNELS.resumeSelected`'s response (V2-T4 item 4) — the full per-session breakdown, same
 * content as `cli/format-start-day.ts#formatStartDaySummary` (resumed, skipped, invalid fallback
 * answers, not-yet-attempted, and where the loop stopped early), rendered by the panel as DOM
 * sections instead of reusing the CLI's plain-text rendering (Q-073's own "only the data crosses
 * the boundary" — V2-T2's criterion for the status panel). Built by
 * `state/resume-summary.ts#buildResumeSummary`. */
export interface ResumeSummaryResponse {
  readonly resumed: readonly ResumeSummaryOutcome[];
  readonly skipped: readonly ResumeSummarySkipped[];
  readonly invalidFallbackAnswers: readonly ResumeSummaryInvalid[];
  readonly remaining: readonly ResumeSummarySession[];
  readonly stoppedEarly:
    { readonly session: ResumeSummarySession; readonly message: string } | false;
}

export interface ResumeProgressUpdateEvent {
  readonly index: number;
  readonly total: number;
  readonly name: string;
}

/** `ResumeTabOpenedEvent.kind` (V2-T64, `docs/INTERFACE.md` § 2's own "ícone por tipo") — which
 * icon the tab strip shows: `'project'` for `seeya project open`'s own tab
 * (`resume/project-tab-launcher.ts#ProjectOpenTabLauncher`), `'session'` for a resumed OR an
 * adopted session (`TabSessionResumer`/`ProjectAdoptTabLauncher` — the two share one icon, the
 * spec never asks to tell them apart visually). A tab opened from the New tab popover never goes
 * through this event at all (`CHANNELS.createTab` instead) — it is always the generic terminal
 * icon, regardless of which command was typed. */
export type ResumeTabOpenedKind = 'project' | 'session';

export interface ResumeTabOpenedEvent {
  readonly id: string;
  readonly label: string;
  readonly cwd: string;
  readonly pid: number;
  readonly kind: ResumeTabOpenedKind;
}
