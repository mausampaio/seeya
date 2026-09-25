/**
 * Production defect (PO review, 2026-09-25, V2-T34): the workspace's own git hook and the
 * harness's own `PreToolUse` hook both pre-flight `cliEntryPath` with a plain `[ -f "$path" ]`
 * before calling it (`core/workspace-hooks.ts#buildCommitMsgHookScript`,
 * `core/harness-hook-config.ts#buildHarnessHookCommand`). Under a REAL packaged install,
 * `cliEntryPath` is a path INSIDE Electron's `app.asar`
 * (`/opt/seeya/resources/app.asar/node_modules/@seeya-ai/cli/dist/index.js`, and the Windows
 * equivalent) — Electron's own patched `fs` reads straight into the archive, but to the actual
 * filesystem (and to a POSIX shell's `[ -f ... ]`, which never goes through Electron's patch)
 * `app.asar` is one ordinary file. The full inner path can never exist as a file or a directory,
 * so the check always failed, and BOTH hooks recused themselves on every real install: the git
 * hook refused every commit in the workspace, and the harness hook exited 2 (`PreToolUse`'s own
 * "only exit 2 blocks" convention) and blocked every Bash tool call in every open project.
 *
 * The fix: for a path that crosses into a `.asar` archive, existence is checked against the
 * `.asar` file itself (the path truncated right after that segment) — that file DOES exist on a
 * real install, and its presence is exactly what "seeya wasn't moved or uninstalled" means once
 * `cliEntryPath` lives inside one. Any other path (a plain unpacked `node_modules`, `node`'s own
 * binary, a dev checkout) is checked as-is, unchanged from before this fix. `nodePath` is never
 * asar-aware on purpose — it's always Electron's OWN executable or a real `node` binary, never a
 * path Electron packs into the archive.
 */

const ASAR_SEGMENT = /^(.*\.asar)(?:[/\\].*)?$/i;

/**
 * @example
 * resolveHookVerifierCheckPath(
 *   '/opt/seeya/resources/app.asar/node_modules/@seeya-ai/cli/dist/index.js',
 * )
 * // '/opt/seeya/resources/app.asar'
 * resolveHookVerifierCheckPath('/opt/seeya/dist/index.js')
 * // '/opt/seeya/dist/index.js' (unchanged — no `.asar` segment to truncate at)
 */
export function resolveHookVerifierCheckPath(cliEntryPath: string): string {
  const match = ASAR_SEGMENT.exec(cliEntryPath);
  return match === null ? cliEntryPath : (match[1] as string);
}
