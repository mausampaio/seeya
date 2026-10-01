/**
 * The base empty state (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "estado vazio", e.g. Today's
 * own "nothing to resume" panel, `docs/INTERFACE.md` § 3). `action` is a slot for a `Button` (e.g.
 * `New project` on an empty Projects tab) — never rendered by this component itself, so it never
 * has to know what the action does.
 *
 * @example
 * <EmptyState title="Nothing to resume" description="Every session from today is already open." />
 *
 * Relocated from `ui/` by D-052 (V2-T75) — still no production caller (confirmed by grep before
 * moving it) and still styled by `renderer/legacy/components.css`'s own `.seeya-empty-state*`
 * global classes, not a CSS module yet; left for the region task that first puts it on screen.
 */
import type { ComponentChildren, JSX } from 'preact';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ComponentChildren;
}

export function EmptyState(props: EmptyStateProps): JSX.Element {
  return (
    <div class="seeya-empty-state">
      <p class="seeya-empty-state-title">{props.title}</p>
      {props.description !== undefined && (
        <p class="seeya-empty-state-description">{props.description}</p>
      )}
      {props.action !== undefined && <div class="seeya-empty-state-action">{props.action}</div>}
    </div>
  );
}
