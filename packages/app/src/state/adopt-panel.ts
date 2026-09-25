/**
 * V2-T30 item 5's own state machine — "Adopt…" on an "Other sessions" row. Pure: no I/O, no
 * Electron, no DOM — `electron/project-panel-view.ts` is the only caller, feeding it clicks and
 * the three IPC pushes `electron/project-ipc.ts#wireProjectIpc` sends mid-flight.
 *
 * **Six states, not four, because the flow crosses TWO confirmations and a real interactive tab in
 * between them** (`application/project-adopt.ts#adoptSession`'s own sequence: launch confirmation →
 * fork spawned → person works in the tab → commit confirmation → result). `pickProject` is local
 * only (never sent to main until "Continue"); `launchConfirm`/`commitConfirm` are driven by
 * `electron/project-ipc.ts`'s own pushes, mid-`adoptSession` call. **The dialog is deliberately
 * `idle` (closed) between `launchAnswered` and the next push** — a `<dialog>` opened with
 * `showModal()` blocks every other element on the page, including the very tab the person needs to
 * interact with while the fork session is open; keeping this machine's own "nothing to show right
 * now" state as `idle` (not a fifth "waiting" state with its own dialog) is what lets
 * `project-panel-view.ts` simply not call `showModal()` again until a real question or a result
 * actually arrives.
 */
export type AdoptPanelState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pickProject'; readonly sessionId: string; readonly sessionName: string }
  | {
      readonly kind: 'launchConfirm';
      readonly requestId: string;
      readonly explanationLines: readonly string[];
    }
  | {
      readonly kind: 'commitConfirm';
      readonly requestId: string;
      readonly changedFilesLines: readonly string[];
    }
  | {
      readonly kind: 'result';
      readonly outcomeText: string;
      readonly adopted: boolean;
      readonly projectId: string;
    };

export type AdoptPanelEvent =
  | { readonly kind: 'pickerOpened'; readonly sessionId: string; readonly sessionName: string }
  | { readonly kind: 'pickerCancelled' }
  | { readonly kind: 'pickerSubmitted' }
  | {
      readonly kind: 'launchRequestReceived';
      readonly requestId: string;
      readonly explanationLines: readonly string[];
    }
  | { readonly kind: 'launchAnswered' }
  | {
      readonly kind: 'commitRequestReceived';
      readonly requestId: string;
      readonly changedFilesLines: readonly string[];
    }
  | { readonly kind: 'commitAnswered' }
  | {
      readonly kind: 'resultReceived';
      readonly outcomeText: string;
      readonly adopted: boolean;
      readonly projectId: string;
    }
  | { readonly kind: 'resultClosed' };

/**
 * @example
 * let state: AdoptPanelState = { kind: 'idle' };
 * state = reduceAdoptPanel(state, { kind: 'pickerOpened', sessionId: 's1', sessionName: 'x' });
 * state = reduceAdoptPanel(state, { kind: 'pickerSubmitted' }); // -> idle, no dialog open
 * state = reduceAdoptPanel(state, { kind: 'launchRequestReceived', requestId: 'r1', explanationLines: [] });
 */
export function reduceAdoptPanel(state: AdoptPanelState, event: AdoptPanelEvent): AdoptPanelState {
  switch (event.kind) {
    case 'pickerOpened':
      return state.kind === 'idle'
        ? { kind: 'pickProject', sessionId: event.sessionId, sessionName: event.sessionName }
        : state;
    case 'pickerCancelled':
    case 'pickerSubmitted':
      return state.kind === 'pickProject' ? { kind: 'idle' } : state;
    // The two *RequestReceived events arrive from main mid-`adoptSession` call, asynchronously
    // relative to any local click — accepted from any state rather than checking a specific
    // predecessor (D-025: a legitimate push must never be silently dropped just because this
    // machine's own idea of "what came before" doesn't match exactly).
    case 'launchRequestReceived':
      return {
        kind: 'launchConfirm',
        requestId: event.requestId,
        explanationLines: event.explanationLines,
      };
    case 'launchAnswered':
      return state.kind === 'launchConfirm' ? { kind: 'idle' } : state;
    case 'commitRequestReceived':
      return {
        kind: 'commitConfirm',
        requestId: event.requestId,
        changedFilesLines: event.changedFilesLines,
      };
    case 'commitAnswered':
      return state.kind === 'commitConfirm' ? { kind: 'idle' } : state;
    case 'resultReceived':
      return {
        kind: 'result',
        outcomeText: event.outcomeText,
        adopted: event.adopted,
        projectId: event.projectId,
      };
    case 'resultClosed':
      return state.kind === 'result' ? { kind: 'idle' } : state;
    default:
      return state;
  }
}
