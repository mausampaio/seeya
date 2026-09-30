/**
 * D-052 (V2-T75): the scale every layout primitive's props are typed against — "as props aceitam
 * só a escala de tokens (`gap="md"`, `padding="lg"`, `span={6}`), nunca pixel solto — o tipo
 * recusa o que a identidade não prevê" (D-024). Shared here, once, so `Stack`/`Grid`/`Surface`
 * never each hand-roll their own copy of the same name → CSS variable mapping (AGENTS.md: "nada
 * de duplicação").
 *
 * Named semantically (`xs`…`4xl`), not after the CSS variable suffix (`--seeya-space-4` etc.) —
 * `design/IDENTIDADE_VISUAL.md` § 6.1 names `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96` as the
 * grade and calls out `16`, `24` and `32` as the ones to prefer; this scale keeps exactly those
 * three as `md`/`lg`/`xl` (the names a caller reaches for first) and covers the rest of the grade
 * around them. `12px` (`--seeya-space-3`) is deliberately left out of the NAMED scale — the grade
 * still has it (a `.module.css` file can reach for `var(--seeya-space-3)` directly for the rare
 * case that needs it), but no semantic name sits well between `sm` (8) and `md` (16) without
 * making the whole scale harder to reach for.
 */
export type SpaceToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

const SPACE_VALUES: Record<SpaceToken, string> = {
  none: '0',
  xs: 'var(--seeya-space-1)',
  sm: 'var(--seeya-space-2)',
  md: 'var(--seeya-space-4)',
  lg: 'var(--seeya-space-6)',
  xl: 'var(--seeya-space-8)',
  '2xl': 'var(--seeya-space-12)',
  '3xl': 'var(--seeya-space-16)',
  '4xl': 'var(--seeya-space-24)',
};

/**
 * @example
 * spaceValue('md'); // 'var(--seeya-space-4)'
 */
export function spaceValue(token: SpaceToken): string {
  return SPACE_VALUES[token];
}

/** `design/IDENTIDADE_VISUAL.md` § 6.2 — named after the identity's own token names directly,
 * since those are already the semantic name (no `sm`/`md`/`lg` relabelling needed on top). */
export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

const RADIUS_VALUES: Record<RadiusToken, string> = {
  none: '0',
  sm: 'var(--seeya-radius-sm)',
  md: 'var(--seeya-radius-md)',
  lg: 'var(--seeya-radius-lg)',
  xl: 'var(--seeya-radius-xl)',
  full: 'var(--seeya-radius-full)',
};

/**
 * @example
 * radiusValue('lg'); // 'var(--seeya-radius-lg)'
 */
export function radiusValue(token: RadiusToken): string {
  return RADIUS_VALUES[token];
}

/** `design/IDENTIDADE_VISUAL.md` § 6.3: "sombras apenas para sobreposição real" — named after the
 * two shadow tokens that exist (`--seeya-shadow-popover`/`--seeya-shadow-dialog`), never a third,
 * unnamed level nobody asked for. */
export type ElevationToken = 'none' | 'popover' | 'dialog';

const ELEVATION_VALUES: Record<ElevationToken, string> = {
  none: 'none',
  popover: 'var(--seeya-shadow-popover)',
  dialog: 'var(--seeya-shadow-dialog)',
};

/**
 * @example
 * elevationValue('popover'); // 'var(--seeya-shadow-popover)'
 */
export function elevationValue(token: ElevationToken): string {
  return ELEVATION_VALUES[token];
}
