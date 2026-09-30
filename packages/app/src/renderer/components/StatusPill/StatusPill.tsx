/**
 * The base status pill (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "pílula de estado", e.g. the
 * lateral's future `Daemon running`/`3 running` pills, `docs/INTERFACE.md` § 1). Always text, never
 * colour alone (identity § 8: "estado sempre com texto ou ícone, nunca só cor") — this component
 * has no variant that renders just a coloured dot, on purpose: `children` is required, not optional.
 *
 * @example
 * <StatusPill tone="success">3 running</StatusPill>
 */
import type { ComponentChildren, JSX } from 'preact';

export type StatusPillTone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

export interface StatusPillProps {
  readonly tone: StatusPillTone;
  readonly children: ComponentChildren;
}

export function StatusPill(props: StatusPillProps): JSX.Element {
  return <span class={`seeya-status-pill seeya-status-pill--${props.tone}`}>{props.children}</span>;
}
