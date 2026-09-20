// Type declaration for `dist-platform-check.mjs`, only for consumption from outside
// `packages/app/scripts/` (dist.mjs itself, and the test in
// `tests/unit/app/scripts/dist-platform-check.test.ts`) — same pattern as
// `check-package-description.d.mts` right next to this file (see its own comment for why this is
// needed at all).

// Discriminated union (D-024), matching what checkPlatformSupport actually returns — `message`
// only exists on the rejecting branch.
export type PlatformSupportResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export function checkPlatformSupport(
  args: readonly string[],
  hostPlatform: string,
): PlatformSupportResult;
