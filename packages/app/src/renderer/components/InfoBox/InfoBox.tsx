/**
 * The base info box (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "caixa informativa", e.g. the
 * cwd-history note inside a Today card, `docs/INTERFACE.md` § 3, or End day's cost-ceiling note,
 * § 6). `tone` defaults to `neutral` — most info boxes in this window are plain context, not a
 * warning or an error.
 *
 * @example
 * <InfoBox tone="warning">This session changed directory since it last ran.</InfoBox>
 */
import type { ComponentChildren, JSX } from 'preact';

export type InfoBoxTone = 'neutral' | 'info' | 'warning' | 'error';

export interface InfoBoxProps {
  readonly tone?: InfoBoxTone;
  readonly children: ComponentChildren;
}

export function InfoBox(props: InfoBoxProps): JSX.Element {
  const tone = props.tone ?? 'neutral';
  return <div class={`seeya-info-box seeya-info-box--${tone}`}>{props.children}</div>;
}
