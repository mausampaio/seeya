/**
 * The base info box (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "caixa informativa", e.g. the
 * cwd-history note inside a Today session card, `docs/INTERFACE.md` § 3, or End day's cost-ceiling
 * note, § 6). `tone` defaults to `neutral` — most info boxes in this window are plain context, not
 * a warning or an error. A plain container like `Surface` — it never wraps `children` in a `Text`
 * of its own, since a caller's content can be more than one line (`CwdChangeNotice`'s own note +
 * explanation + a `Select`); each piece of text inside still goes through `Text` at the CALL site
 * (D-052 item 7), this component only sets the tone's own background/text colour.
 *
 * @example
 * <InfoBox tone="info">
 *   <Text as="p" variant="body-sm">This session changed directory since it last ran.</Text>
 * </InfoBox>
 *
 * Brought to the CSS-module/render-tested pattern by V2-T66 (D-052, Q-102) — first production
 * caller is Today's own `CwdChangeNotice` (`docs/INTERFACE.md` § 3). `tone` is now the SHARED
 * `Tone` (`renderer/components/props.ts`) rather than its own narrower vocabulary — the maintainer's
 * own complement already names `neutral`/`info`/`warning`/`error` as roles an info box can carry,
 * and `brand`/`success` cost nothing extra to support once this component has a real `.module.css`
 * mapping every tone to a token, the same shape `Chip`'s own `.soft.*` rules already use.
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './InfoBox.module.css';
import { cx, mergeClassName } from '../css-class.js';
import type { Tone } from '../props.js';

export interface InfoBoxProps {
  readonly tone?: Tone;
  readonly className?: string;
  readonly children: ComponentChildren;
}

export function InfoBox(props: InfoBoxProps): JSX.Element {
  const tone = props.tone ?? 'neutral';
  return (
    <div class={mergeClassName(cx(styles, 'infoBox', tone), props.className)}>{props.children}</div>
  );
}
