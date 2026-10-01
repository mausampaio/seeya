/**
 * D-052 (V2-T75, complemento do mantenedor 2026-09-30): the shared prop vocabulary every
 * component in this design system reuses instead of inventing its own name for the same idea —
 * "toda característica que varia e se repete vira prop tipada, nunca classe ou CSS avulso no uso."
 * Registered in `AGENTS.md`'s glossary before this file existed.
 */

/** The semantic colour roles a component can carry — `design/IDENTIDADE_VISUAL.md` § 3.4's own
 * four categories (`success`/`info`/`warning`/`error`) plus `neutral` (no strong semantic) and
 * `brand` (the violet primary, for emphasis that isn't a status). Never a bare hex or a one-off
 * class name at the call site — a component that needs colour takes `tone` and its own
 * `.module.css` is the only place that maps each value to a token. */
export type Tone = 'neutral' | 'brand' | 'success' | 'info' | 'warning' | 'error';

/** The size scale shared by every component that has more than one size (`Chip`, `IconButton`,
 * `Button`) — never a pixel value at the call site. */
export type Size = 'sm' | 'md' | 'lg';
