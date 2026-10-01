/**
 * V2-T69's own state machine for the "End day…" dialog (`docs/INTERFACE.md` § 6) — rewritten from
 * V2-T5a's text-report version into six phases carrying structured data instead of a literal
 * `reportText` (D-024: "the CLI's text, never duplicated here" — every list comes from
 * `state/end-day-sessions.ts`'s own rows, built from the SAME `EndDayResult` the CLI reads). Pure:
 * no I/O, no Electron, no DOM — `renderer/features/end-day/useEndDay.ts` is the only caller,
 * feeding it clicks and IPC responses and rendering whatever state comes back.
 *
 * **Six phases, not five.** `idle` → `previewPending` → `preview` → `starting` → `running` →
 * `result` → `idle`. `starting` is new: it carries the SAME preview data as `preview` (so the
 * dialog can keep showing it, read-only, with "Run end-day now" in its own `loading` state) while
 * the real `endDay()` call does its own discovery + eligibility pass for real before the first
 * `captureStarted` event ever fires (`application/end-day.ts`'s own pipeline — genuinely
 * non-instant for a realistic number of sessions, not a cosmetic delay). `runFinished` can land
 * directly from `starting`, skipping `running` altogether — zero sessions in scope finishes with no
 * progress events at all (D-025: that must not get stuck showing a perpetual "starting…").
 *
 * **`visible` (on `running`/`result` only) is independent of the phase itself.** "Hide" closes the
 * dialog without touching the capture in flight (`docs/INTERFACE.md` § 6 item 2) — the SAME
 * `running` phase keeps updating in the background, just with `visible: false`; the sidebar
 * footer reads this to show its own "capturing…"/"finished" reopen affordance
 * (`describeEndDayFooterLabel` below). `idle`/`previewPending`/`preview`/`starting` have no
 * `visible` field at all — Hide is never offered before a run has actually started
 * (`docs/INTERFACE.md` § 6: Hide is item 2's own button, not item 1's), so "always visible" is the
 * type itself, not a convention a component has to remember (D-024).
 *
 * **Per-session status survives even under concurrency.** `sessionStarted`/`sessionFinished` key
 * by `sessionId`, never by array position or "the most recent one" — with
 * `config.captureConcurrency > 1`, more than one session can be `capturing` at once, and each row
 * updates independently. The headline text (`current`) still only ever shows the latest
 * `sessionStarted`, the same simplification V2-T5a already shipped ("a interface mostra apenas o
 * que está rodando agora") — the per-row list is what makes the FULL picture honest now, not the
 * headline.
 */
import { MESSAGES } from '../text/messages.js';
import type { EndDayCostCeiling } from './end-day-preview.js';
import type {
  EndDayNotCapturedRow,
  EndDayReasonRow,
  EndDaySessionSummaryRow,
} from './end-day-sessions.js';

export type EndDaySessionProgressStatus =
  'waiting' | 'capturing' | 'captured' | 'ineligible' | 'failed';

export interface EndDaySessionProgress {
  readonly sessionId: string;
  readonly name: string;
  readonly status: EndDaySessionProgressStatus;
}

export interface EndDayPreviewData {
  readonly willBeCaptured: readonly EndDaySessionSummaryRow[];
  readonly notCaptured: readonly EndDayNotCapturedRow[];
  readonly costCeiling: EndDayCostCeiling;
}

export interface EndDayResultData {
  readonly captured: readonly EndDaySessionSummaryRow[];
  readonly failed: readonly EndDayReasonRow[];
  readonly skipped: readonly EndDayReasonRow[];
}

export interface EndDayCurrentCapture {
  readonly index: number;
  readonly total: number;
  readonly name: string;
}

export type EndDayPanelState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'previewPending' }
  | ({ readonly kind: 'preview' } & EndDayPreviewData)
  | ({ readonly kind: 'starting' } & EndDayPreviewData)
  | {
      readonly kind: 'running';
      readonly visible: boolean;
      readonly sessions: readonly EndDaySessionProgress[];
      /** Never `null` (D-024): the ONLY way into `running` is `handleSessionStarted`, which always
       * carries the event that produced it — the "no progress yet" gap lives entirely in the
       * `starting` phase above, which renders the frozen preview instead of a `running` view with
       * nothing to show. */
      readonly current: EndDayCurrentCapture;
    }
  | ({ readonly kind: 'result'; readonly visible: boolean } & EndDayResultData);

export type EndDayPanelEvent =
  | { readonly kind: 'openClicked' }
  | ({ readonly kind: 'previewReady' } & EndDayPreviewData)
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'runClicked' }
  | {
      readonly kind: 'sessionStarted';
      readonly sessionId: string;
      readonly name: string;
      readonly index: number;
      readonly total: number;
    }
  | {
      readonly kind: 'sessionFinished';
      readonly sessionId: string;
      readonly outcome: 'captured' | 'ineligible' | 'failed';
    }
  | ({ readonly kind: 'runFinished' } & EndDayResultData)
  | { readonly kind: 'hidden' }
  | { readonly kind: 'reopened' }
  | { readonly kind: 'closed' };

/** Seeds the running view's own tracked rows from the preview's two lists — `willBeCaptured` plus
 * every `notCaptured` row EXCEPT `kind: 'closed'` ones: a closed session (D-031) never went through
 * `runSession` at all, so it never gets a `captureStarted`/`captureFinished` event to update it,
 * and showing it stuck on "waiting" forever would be a lie (D-025). */
function seedTrackedSessions(preview: EndDayPreviewData): EndDaySessionProgress[] {
  const fromCaptured = preview.willBeCaptured.map((row) => ({
    sessionId: row.sessionId,
    name: row.name,
    status: 'waiting' as const,
  }));
  const fromNotCaptured = preview.notCaptured
    .filter((row) => row.kind !== 'closed')
    .map((row) => ({ sessionId: row.sessionId, name: row.name, status: 'waiting' as const }));
  return [...fromCaptured, ...fromNotCaptured];
}

/** A `captureStarted` for a `sessionId` this panel never seeded (shouldn't happen — every tracked
 * session comes straight from the same `EndDayResult` the real run re-derives — but D-025: showing
 * fewer rows than `total` would be a worse lie than one unexpected row) is appended instead of
 * dropped. */
function markSessionStarted(
  sessions: readonly EndDaySessionProgress[],
  sessionId: string,
  name: string,
): EndDaySessionProgress[] {
  if (!sessions.some((session) => session.sessionId === sessionId)) {
    return [...sessions, { sessionId, name, status: 'capturing' }];
  }
  return sessions.map((session) =>
    session.sessionId === sessionId ? { ...session, status: 'capturing' } : session,
  );
}

function markSessionFinished(
  sessions: readonly EndDaySessionProgress[],
  sessionId: string,
  outcome: EndDaySessionProgressStatus,
): EndDaySessionProgress[] {
  return sessions.map((session) =>
    session.sessionId === sessionId ? { ...session, status: outcome } : session,
  );
}

function handleSessionStarted(
  state: EndDayPanelState,
  event: Extract<EndDayPanelEvent, { kind: 'sessionStarted' }>,
): EndDayPanelState {
  const current = { index: event.index, total: event.total, name: event.name };
  if (state.kind === 'starting') {
    return {
      kind: 'running',
      visible: true,
      sessions: markSessionStarted(seedTrackedSessions(state), event.sessionId, event.name),
      current,
    };
  }
  if (state.kind === 'running') {
    return {
      ...state,
      sessions: markSessionStarted(state.sessions, event.sessionId, event.name),
      current,
    };
  }
  return state;
}

/** @example
 * let state: EndDayPanelState = { kind: 'idle' };
 * state = reduceEndDayPanel(state, { kind: 'openClicked' }); // -> previewPending
 * state = reduceEndDayPanel(state, { kind: 'previewReady', willBeCaptured, notCaptured, costCeiling }); // -> preview
 * state = reduceEndDayPanel(state, { kind: 'runClicked' }); // -> starting
 * state = reduceEndDayPanel(state, { kind: 'sessionStarted', sessionId, name, index: 1, total: 1 }); // -> running
 * state = reduceEndDayPanel(state, { kind: 'runFinished', captured, failed, skipped }); // -> result
 */
export function reduceEndDayPanel(
  state: EndDayPanelState,
  event: EndDayPanelEvent,
): EndDayPanelState {
  switch (event.kind) {
    case 'openClicked':
      return state.kind === 'idle' ? { kind: 'previewPending' } : state;
    case 'previewReady':
      return state.kind === 'previewPending'
        ? {
            kind: 'preview',
            willBeCaptured: event.willBeCaptured,
            notCaptured: event.notCaptured,
            costCeiling: event.costCeiling,
          }
        : state;
    case 'cancelled':
      return state.kind === 'previewPending' || state.kind === 'preview' ? { kind: 'idle' } : state;
    case 'runClicked':
      return state.kind === 'preview'
        ? {
            kind: 'starting',
            willBeCaptured: state.willBeCaptured,
            notCaptured: state.notCaptured,
            costCeiling: state.costCeiling,
          }
        : state;
    case 'sessionStarted':
      return handleSessionStarted(state, event);
    case 'sessionFinished':
      return state.kind === 'running'
        ? {
            ...state,
            sessions: markSessionFinished(state.sessions, event.sessionId, event.outcome),
          }
        : state;
    case 'runFinished':
      return state.kind === 'starting' || state.kind === 'running'
        ? {
            kind: 'result',
            visible: state.kind === 'running' ? state.visible : true,
            captured: event.captured,
            failed: event.failed,
            skipped: event.skipped,
          }
        : state;
    // Hide/reopen only ever apply to a phase that actually offers the button (`running`/`result`) —
    // every other phase is already either fully visible by contract (`preview`/`starting`) or has
    // no dialog open at all (`idle`), so both are no-ops anywhere else (defense in depth, the same
    // discipline V2-T5a's own `cancelled`/`runClicked` guards already follow).
    case 'hidden':
      return state.kind === 'running' || state.kind === 'result'
        ? { ...state, visible: false }
        : state;
    case 'reopened':
      return state.kind === 'running' || state.kind === 'result'
        ? { ...state, visible: true }
        : state;
    case 'closed':
      return state.kind === 'result' ? { kind: 'idle' } : state;
    default:
      return state;
  }
}

/**
 * V2-T69 (`docs/INTERFACE.md` § 6 item 2): what the sidebar footer's own "End day…" button shows
 * once the dialog is hidden mid-capture or finished unseen — the ONE place that decides this
 * sentence (AGENTS.md § "Texto voltado ao usuário": concentrated, not scattered through
 * `SidebarFooter.tsx`). Every other phase keeps the plain trigger label — clicking it then starts a
 * fresh preview (`idle`) or simply reopens whatever is already showing underneath (`useEndDay.ts`
 * decides which, from the SAME `state.kind` this function already switches on).
 *
 * @example
 * describeEndDayFooterLabel({ kind: 'idle' }) // 'End day…'
 * describeEndDayFooterLabel({ kind: 'running', visible: false, sessions: [], current: { index: 1, total: 3, name: 'x' } })
 * // 'Capturing 1 of 3…'
 */
export function describeEndDayFooterLabel(state: EndDayPanelState): string {
  if (state.kind === 'running' && !state.visible) {
    return MESSAGES.endDayFooterCapturing(state.current.index, state.current.total);
  }
  if (state.kind === 'result' && !state.visible) {
    return MESSAGES.endDayFooterFinishedHidden;
  }
  return MESSAGES.endDayButton;
}
