/**
 * D-052 (V2-T75), item 7 ("Texto só pela escala tipográfica"), PO review (2026-10-01): the design
 * system's single typographic primitive — every `font-size`/`line-height`/`font-weight` in this
 * window comes from `design/IDENTIDADE_VISUAL.md` § 4.4 through this component, never a raw value
 * picked at the call site. The defect this replaces: the sidebar alone had five different
 * font-sizes (11/12/13/14/16px) with no scale behind any of them — "All projects"/"Sessions"
 * (13px, `NavItem`'s own hardcoded value) read LARGER than project names (12px), and "Daemon
 * running"/"Disable autostart" (16px, `Button`'s own `lg` size) read largest of all, with no
 * reason tied to their actual importance in the layout.
 *
 * `variant` is the identity's own token name (`body-md`/`caption`/`heading-3`/…) — each one is a
 * SIZE+LINE-HEIGHT+DEFAULT-WEIGHT triple (identity § 4.4's own table), never picked apart into
 * three separate props a caller could mismatch (D-024: the type should make "13px text at the
 * `caption` line-height" unrepresentable, not just discouraged). `weight` overrides the variant's
 * own default only for the two cases the identity allows mixing (`docs/INTERFACE.md` § 1's own
 * "peso 500 nos itens de navegação e no nome do projeto ativo") — never a free-standing number
 * disconnected from the variant it modifies.
 *
 * @example
 * <Text variant="body-sm">Payments webhooks</Text>
 * <Text variant="caption" tone="secondary">Favorites</Text>
 * <Text variant="body-sm" weight={500} truncate>auth-hardening-very-long-session-name</Text>
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Text.module.css';
import { cx, mergeClassName } from '../css-class.js';

/** `design/IDENTIDADE_VISUAL.md` § 4.4 — the whole scale, even though the sidebar (this task's own
 * scope) only reaches for a handful of these; the others exist so the NEXT region migrated onto
 * `Text` never invents a second name for the same row of that table. */
export type TextVariant =
  | 'display'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'caption'
  | 'code';

export type TextTone = 'primary' | 'secondary' | 'tertiary';

/** Only the three weights the identity's own scale ever uses (§ 4.4's "Peso" column) — a `number`
 * prop would accept `450`, which no variant in this design system has ever meant anything by. */
export type TextWeight = 400 | 500 | 600;

export type TextElement = 'span' | 'p' | 'div' | 'label' | 'h1' | 'h2' | 'h3' | 'h4';

export interface TextProps {
  readonly variant: TextVariant;
  readonly tone?: TextTone;
  /** Overrides the variant's own default weight — `docs/INTERFACE.md` § 1's own two named
   * exceptions ("peso 500 nos itens de navegação e no nome do projeto ativo"), never a free
   * choice disconnected from a real spec line. */
  readonly weight?: TextWeight;
  /** `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` — PO review (2026-10-01):
   * "toda linha trunca com reticências" is a characteristic several sidebar rows repeat (a
   * project name, a session name), so it is a prop here rather than every caller re-declaring the
   * same three CSS properties (AGENTS.md: "nada de duplicação"). Requires the element itself (or
   * an ancestor flex item) to have `min-width: 0` — a flex item's default `min-width: auto` would
   * otherwise keep it from ever shrinking enough to need the ellipsis at all. */
  readonly truncate?: boolean;
  readonly as?: TextElement;
  readonly id?: string;
  readonly title?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

const VARIANT_CLASS_NAME: Record<TextVariant, string> = {
  display: 'display',
  'heading-1': 'heading1',
  'heading-2': 'heading2',
  'heading-3': 'heading3',
  'heading-4': 'heading4',
  'body-lg': 'bodyLg',
  'body-md': 'bodyMd',
  'body-sm': 'bodySm',
  caption: 'caption',
  code: 'code',
};

const TONE_CLASS_NAME: Record<TextTone, string> = {
  primary: 'tonePrimary',
  secondary: 'toneSecondary',
  tertiary: 'toneTertiary',
};

const WEIGHT_CLASS_NAME: Record<TextWeight, string> = {
  400: 'weight400',
  500: 'weight500',
  600: 'weight600',
};

export function Text(props: TextProps): JSX.Element {
  const Element = props.as ?? 'span';
  const className = mergeClassName(
    cx(
      styles,
      VARIANT_CLASS_NAME[props.variant],
      TONE_CLASS_NAME[props.tone ?? 'primary'],
      props.weight !== undefined && WEIGHT_CLASS_NAME[props.weight],
      props.truncate === true && 'truncate',
    ),
    props.className,
  );
  return (
    <Element id={props.id} class={className} title={props.title}>
      {props.children}
    </Element>
  );
}
