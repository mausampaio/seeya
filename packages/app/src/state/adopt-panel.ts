/**
 * V2-T70 (`docs/INTERFACE.md` § 7): the "Adopt…" flow's own state machine — rewritten from V2-T30
 * item 5's four-dialog version into the single merged picker the spec now asks for (pick a
 * project, see the three-step explanation, and submit, all in one dialog that doubles as the
 * answer to `adoptSession`'s own launch confirmation — see `renderer/features/adoption/
 * useAdoption.ts`'s own docstring for why `confirmLaunch` no longer needs a round trip at all).
 * Pure: no I/O, no Electron, no DOM — `renderer/features/adoption/useAdoption.ts` is the only
 * caller, feeding it the picker's own local submit and the one IPC push still mid-flight
 * (`confirmAdoptionCommitRequest`).
 *
 * **Four states, not six** (V2-T30's `pickProject`/`launchConfirm`/`commitConfirm`/`result`,
 * `idle` doing double duty for two of them): `pickProject` is the one visible dialog before
 * submission; `launching` is the SAME "dialog closed, a real fork tab is running" idea V2-T30's
 * own `idle`-between-pushes already was, named explicitly now that there is no second confirmation
 * left to silently skip through it — a second "Adopt…" click while a fork is already running is
 * rejected by `pickerOpened`'s own `state.kind === 'idle'` guard exactly as before (a fork in
 * flight is never `idle`). `commitConfirm`/`result` are unchanged in shape from V2-T30, just with
 * `commitConfirm` carrying `ChangedFileStatsEntry[]` (V2-T70's own structured type/line-count
 * read) instead of pre-rendered text lines.
 */
import type { ChangedFileStatsEntry } from '@seeya-ai/engine/core/ports.js';
import type { SessionState } from '@seeya-ai/engine/core/types.js';

/** The step 1 card's own facts (`docs/INTERFACE.md` § 7 item 1: "cartão da sessão: nome, id,
 * diretório, estado") — everything the Sessions tab's own row already has, carried through so the
 * dialog never has to ask main for it again. */
export interface AdoptionSessionCard {
  readonly sessionId: string;
  readonly name: string;
  readonly displaySessionId: string;
  readonly cwd: string;
  readonly state: SessionState;
  readonly stateLabel: string;
}

export type AdoptPanelState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pickProject'; readonly session: AdoptionSessionCard }
  | { readonly kind: 'launching' }
  | {
      readonly kind: 'commitConfirm';
      readonly requestId: string;
      readonly entries: readonly ChangedFileStatsEntry[];
    }
  | {
      readonly kind: 'result';
      readonly outcomeText: string;
      readonly adopted: boolean;
      readonly projectId: string;
    };

export type AdoptPanelEvent =
  | { readonly kind: 'pickerOpened'; readonly session: AdoptionSessionCard }
  | { readonly kind: 'pickerCancelled' }
  | { readonly kind: 'pickerSubmitted' }
  | {
      readonly kind: 'commitRequestReceived';
      readonly requestId: string;
      readonly entries: readonly ChangedFileStatsEntry[];
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
 * state = reduceAdoptPanel(state, { kind: 'pickerOpened', session });
 * state = reduceAdoptPanel(state, { kind: 'pickerSubmitted' }); // -> launching, dialog closed
 */
export function reduceAdoptPanel(state: AdoptPanelState, event: AdoptPanelEvent): AdoptPanelState {
  switch (event.kind) {
    case 'pickerOpened':
      return state.kind === 'idle' ? { kind: 'pickProject', session: event.session } : state;
    case 'pickerCancelled':
      return state.kind === 'pickProject' ? { kind: 'idle' } : state;
    case 'pickerSubmitted':
      return state.kind === 'pickProject' ? { kind: 'launching' } : state;
    // Arrives from main mid-`adoptSession` call, asynchronously relative to any local click —
    // accepted from any state rather than checking a specific predecessor (D-025: a legitimate
    // push must never be silently dropped just because this machine's own idea of "what came
    // before" doesn't match exactly).
    case 'commitRequestReceived':
      return { kind: 'commitConfirm', requestId: event.requestId, entries: event.entries };
    case 'commitAnswered':
      return state.kind === 'commitConfirm' ? { kind: 'launching' } : state;
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
