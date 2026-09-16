/**
 * V2-T5a's own state machine — "ocioso → prévia → rodando → resultado" (docs/PLANO-DE-ENTREGA.md
 * V2-T5a, "Cuidados"). Pure: no I/O, no Electron, no DOM — `electron/renderer.ts` is the only
 * caller, feeding it user clicks and IPC responses and re-rendering the dialog from whatever state
 * comes back.
 *
 * **Five states, not four, on purpose.** The named "prévia" state splits into `previewPending`
 * (the dry run is in flight — it spawns a real headless `claude -p` per session,
 * `application/end-day.ts`'s own docstring: "everything upstream of a write ... runs for real
 * either way", so this can take real time) and `preview` (the report text is ready, "Run end-day
 * now"/"Cancel" are live) — D-024: a caller must not be able to render preview buttons before the
 * preview text they'd act on has actually arrived. Likewise `running` carries a `progressText`
 * that starts `null` (no progress event has arrived yet) and is refined by each `progress` event —
 * never a placeholder string standing in for "nothing yet" (D-025).
 *
 * **Unrecognized transitions are ignored, not thrown** (`reduceEndDayPanel`'s own `default: return
 * state`): a stray `progress` event arriving after `runFinished` already fired (e.g. an IPC message
 * queued before the dialog moved on) must never crash the panel — it's simply too late to matter.
 * This is also what makes a double click safe: `electron/renderer.ts` disables the buttons a state
 * doesn't offer, but the reducer itself refuses the disallowed transition too, defense in depth
 * (docs/PLANO-DE-ENTREGA.md V2-T5a item 4: "um segundo clique não enfileira").
 */
import type { EndDayCostCeiling } from './end-day-preview.js';

export type EndDayPanelState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'previewPending' }
  | {
      readonly kind: 'preview';
      readonly reportText: string;
      readonly costCeiling: EndDayCostCeiling;
    }
  | { readonly kind: 'running'; readonly progressText: string | null }
  | { readonly kind: 'result'; readonly reportText: string };

export type EndDayPanelEvent =
  | { readonly kind: 'openClicked' }
  | {
      readonly kind: 'previewReady';
      readonly reportText: string;
      readonly costCeiling: EndDayCostCeiling;
    }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'runClicked' }
  | { readonly kind: 'progress'; readonly progressText: string }
  | { readonly kind: 'runFinished'; readonly reportText: string }
  | { readonly kind: 'closed' };

/**
 * @example
 * let state: EndDayPanelState = { kind: 'idle' };
 * state = reduceEndDayPanel(state, { kind: 'openClicked' }); // -> previewPending
 * state = reduceEndDayPanel(state, { kind: 'previewReady', reportText, costCeiling }); // -> preview
 * state = reduceEndDayPanel(state, { kind: 'cancelled' }); // -> idle, closing the dialog
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
        ? { kind: 'preview', reportText: event.reportText, costCeiling: event.costCeiling }
        : state;
    case 'cancelled':
      return state.kind === 'previewPending' || state.kind === 'preview' ? { kind: 'idle' } : state;
    case 'runClicked':
      return state.kind === 'preview' ? { kind: 'running', progressText: null } : state;
    case 'progress':
      return state.kind === 'running'
        ? { kind: 'running', progressText: event.progressText }
        : state;
    case 'runFinished':
      return state.kind === 'running' ? { kind: 'result', reportText: event.reportText } : state;
    // Closing the result view (the dialog's own "Close" button, or dismissing it) is the one
    // transition allowed from EVERY state except `idle` itself — it never leaves a stray dialog
    // open behind a panel that thinks it's idle again.
    case 'closed':
      return state.kind === 'idle' ? state : { kind: 'idle' };
    default:
      return state;
  }
}
