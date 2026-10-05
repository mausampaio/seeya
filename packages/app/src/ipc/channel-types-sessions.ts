/**
 * Payload shapes of the session lookup and standalone resume channels (V2-T51: split out of `ipc/channels.ts`, which still re-exports every
 * one of them, so no importer changed). Pure types — no `electron` import.
 */
import type { ProjectPanelOtherSessionRow } from '../state/projects-panel.js';

/** `CHANNELS.findSessionById`'s payload (V2-T55 item 4). */
export interface FindSessionByIdRequest {
  readonly idOrPrefix: string;
}

/** `CHANNELS.findSessionById`'s response — the SAME row shape the Sessions tab's own table uses
 * for a session with no project (`ProjectPanelOtherSessionRow`, V2-T68's own
 * `state/sessions-panel.ts#SessionsPanelRow` builds on it directly), never a second, parallel row
 * type for what's structurally the identical fact. D-025: `ambiguous`/`notFound` are their own
 * cases, never flattened into `found: null`. */
export type FindSessionByIdResponse =
  | { readonly kind: 'found'; readonly session: ProjectPanelOtherSessionRow }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly ProjectPanelOtherSessionRow[] }
  | { readonly kind: 'notFound' };

/** `CHANNELS.resumeSession`'s payload (V2-T68) — `name` labels the tab the same way
 * `ResumeSelectedRequest`'s own handler resolves a label for a handoff-backed resume
 * (`TabResumeOpener.openTab`'s own `label`), since `SessionResumer.resumeWithoutPrompt` itself
 * only ever takes `sessionId`/`cwd` (`core/ports.ts`). */
export interface ResumeSessionRequest {
  readonly sessionId: string;
  readonly cwd: string;
  readonly name: string;
}

/** `CHANNELS.resumeSession`'s response — `resumed: false` covers the one failure
 * `TabSessionResumer#resumeWithoutPrompt` can report (`resumeWithoutPlanFailed`, a fast exit with
 * a non-zero code) — the Sessions tab shows no result area for this action (same precedent
 * `OpenProjectResponse`'s own docstring on "nothing shows a filesystem path back" sets for a
 * fire-and-forget row action, Q-105), so this only ever clears the row's own `loading` state. */
export interface ResumeSessionResponse {
  readonly resumed: boolean;
}
