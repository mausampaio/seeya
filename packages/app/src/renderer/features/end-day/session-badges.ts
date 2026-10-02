/**
 * The "Will be captured"/"Captured" row badges — shared between `PreviewPane` and `ResultPane`
 * (V2-T69), which otherwise each hand-rolled the identical `EndDaySessionSummaryRow` → two-badge
 * mapping (AGENTS.md: "nada de duplicação").
 *
 * PO review round 1 (V2-T69, item 7): `formatSessionStateLabel` is the right, canonical function
 * (`core/session-state-label.ts`) — its return value (`'alive'`/`'idle'`/`'ended'`/`'no running
 * process'`) is the project-wide vocabulary and must stay lowercase everywhere else that reads it
 * (the CLI, the sidebar). The PO's actual complaint was visual: next to `captureModeLabel`'s own
 * `'Lean'`/`'Deep'` (capitalized), the lowercase state badge read inconsistent. The fix capitalizes
 * ONLY the display copy of this one badge, in this one place — never `formatSessionStateLabel`
 * itself, which every other caller still needs lowercase (`sidebar/`, `cli/format-sessions.ts`).
 */
import { formatSessionStateLabel } from '@seeya-ai/engine/core/session-state-label.js';
import type { StatusListBadge } from '../../components/StatusList/index.js';
import { resolveSessionStateTone } from '../../../state/session-state-tone.js';
import type { EndDaySessionSummaryRow } from '../../../state/end-day-sessions.js';

/** @example capitalize('no running process') // 'No running process' */
function capitalize(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function captureModeLabel(mode: EndDaySessionSummaryRow['mode']): string {
  return mode === 'lean' ? 'Lean' : 'Deep';
}

/**
 * @example
 * buildSessionSummaryBadges({ state: 'ended', mode: 'lean', ... })
 * // [{ label: 'Ended', tone: 'neutral' }, { label: 'Lean', tone: 'neutral' }]
 */
export function buildSessionSummaryBadges(
  row: EndDaySessionSummaryRow,
): readonly [StatusListBadge, StatusListBadge] {
  return [
    {
      label: capitalize(formatSessionStateLabel(row.state)),
      tone: resolveSessionStateTone(row.state),
    },
    { label: captureModeLabel(row.mode), tone: 'neutral' },
  ];
}
