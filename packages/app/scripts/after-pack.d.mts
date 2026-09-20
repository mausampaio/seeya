// Type declaration for `after-pack.mjs`, only for consumption from outside
// `packages/app/scripts/` (the test in `tests/unit/app/scripts/after-pack.test.ts`) — same pattern
// as `check-package-description.d.mts` and its own comment: the root program (`tsconfig.json`)
// deliberately doesn't turn on `allowJs`, and `packages/*/scripts/**/*.mjs` is excluded from
// ESLint's type-aware project entirely — so without this file, neither `tsc -p tsconfig.json
// --noEmit` nor ESLint's typed rules could resolve the `.mjs` this file describes. This is never
// the source of truth for behavior, only the public signature callers outside
// `packages/app/scripts/` need to see.

export interface SpawnHelperFs {
  readdirSync(dirPath: string): string[];
  statSync(filePath: string): { readonly mode: number };
  chmodSync(filePath: string, mode: number): void;
}

export function fixSpawnHelperModeIn(fs: SpawnHelperFs, prebuildsDir: string): string[];

export interface AfterPackContext {
  readonly electronPlatformName: string;
  readonly appOutDir: string;
  readonly packager: { getResourcesDir(appOutDir: string): string };
}

export default function afterPack(context: AfterPackContext): Promise<void>;
