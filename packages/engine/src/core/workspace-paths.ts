/**
 * Shared by `core/workspace-commit-guard.ts` (V2-T34 item 1) and `core/project-audit.ts` (V2-T34
 * item 3) — both need to know which project directory(ies) a set of workspace-relative paths
 * touches, from git's own output (`git diff`/`git show ... --name-only`), always forward-slash
 * separated, even on Windows.
 */

/** `null` for a path staged at the workspace root (no `/` at all, e.g. `.gitignore`) — it belongs
 * to no project (D-025: absence, not a guessed project id). */
export function firstPathSegment(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/');
  const slash = normalized.indexOf('/');
  return slash === -1 ? null : normalized.slice(0, slash);
}

/**
 * @example
 * distinctProjectDirs(['auth-hardening/status/current.md', '.gitignore', 'billing-v2/AGENTS.md'])
 * // ['auth-hardening', 'billing-v2'] — order of first appearance, never deduplicated by sorting
 */
export function distinctProjectDirs(paths: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const path of paths) {
    const segment = firstPathSegment(path);
    if (segment !== null) {
      ids.add(segment);
    }
  }
  return [...ids];
}
