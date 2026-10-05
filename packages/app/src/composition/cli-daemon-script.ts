/**
 * Resolves `@seeya-ai/cli's compiled entry point (V2-T5b, V2-T34; V2-T51: split out of
 * `composition/index.ts`) — shared by the daemon launch target and the project hooks.
 */
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

/** A minimal, hand-checked shape — not a zod schema (AGENTS.md's "dados de fora" rule targets the
 * Claude Code registry/transcript/config/`claude -p` output specifically; `@seeya-ai/cli`'s own
 * `package.json` is this monorepo's own build artifact, read the same way Node's own module
 * resolution already reads every `package.json` on disk, not data arriving from outside the
 * project). Still checked, not cast blindly, so a `@seeya-ai/cli` release that ever drops its
 * `bin.seeya` entry fails with a message naming exactly what's missing (AGENTS.md's error-message
 * rule) instead of `spawn` failing later with an opaque ENOENT. */
function readCliBinRelativePath(cliPackage: unknown, packageJsonPath: string): string {
  const bin =
    typeof cliPackage === 'object' && cliPackage !== null
      ? (cliPackage as { readonly bin?: unknown }).bin
      : undefined;
  const seeya =
    typeof bin === 'object' && bin !== null
      ? (bin as { readonly seeya?: unknown }).seeya
      : undefined;
  if (typeof seeya !== 'string') {
    throw new Error(
      `@seeya-ai/cli's package.json (${packageJsonPath}) has no "bin.seeya" string entry — cannot ` +
        'build the daemon launch target.',
    );
  }
  return seeya;
}

/**
 * V2-T5b item 3: resolves `@seeya-ai/cli`'s own compiled bin entry point (`bin.seeya` in its
 * `package.json`) by walking the package boundary, the same way `require.resolve` finds any
 * package on disk — never a hardcoded relative path across the two packages, so this keeps working
 * if `@seeya-ai/cli`'s own `dist/` layout ever changes. This is the ONE place `packages/app/src`
 * resolves anything from `@seeya-ai/cli` — never its source, never its exports, only this single
 * file path to spawn as a detached child (`app-does-not-import-cli`'s own guard, `.dependency-
 * cruiser.cjs`, is about SOURCE imports; a `require.resolve` string literal to a `package.json` two
 * layers below `packages/cli/` — not `packages/cli/src` — is not one, and was confirmed by running
 * `npm run dependencias` after this change, see the report for this task).
 */
export function resolveCliDaemonScriptPath(): string {
  const packageJsonPath = requireFromHere.resolve('@seeya-ai/cli/package.json');
  const cliPackage: unknown = requireFromHere(packageJsonPath);
  const binRelativePath = readCliBinRelativePath(cliPackage, packageJsonPath);
  return path.join(path.dirname(packageJsonPath), binRelativePath);
}
