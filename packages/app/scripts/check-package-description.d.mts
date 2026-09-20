// Type declaration for `check-package-description.mjs`, only for consumption from outside
// `packages/app/scripts/` (dist.mjs's own preflight, and the test in
// `tests/unit/app/scripts/check-package-description.test.ts`) — same pattern as
// `scripts/verificar-termos-locais.d.mts` and its own comment: the root program (`tsconfig.json`)
// deliberately doesn't turn on `allowJs` (see `scripts/tsconfig.json`'s own comment), and
// `packages/*/scripts/**/*.mjs` is excluded from ESLint's type-aware project entirely
// (`eslint.config.js`'s own comment on that ignore entry) — so without this file, neither `tsc -p
// tsconfig.json --noEmit` nor ESLint's typed rules could resolve the `.mjs` this file describes.
// This is never the source of truth for behavior, only the public signature callers outside
// `packages/app/scripts/` need to see.

// Discriminated union (D-024: "o tipo torna o estado inválido irrepresentável"), matching what
// checkDescriptionLength actually returns — `reason` only exists on the rejecting branch.
export type DescriptionCheckResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

export const DESCRIPTION_LENGTH_LIMIT: number;
export function checkDescriptionLength(description: string): DescriptionCheckResult;
