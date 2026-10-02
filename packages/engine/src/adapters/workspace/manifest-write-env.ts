/**
 * The one environment variable that marks a `git commit` seeya itself is launching as one of ITS
 * OWN intentional writes to a project's `seeya.json` (V2-T73 item 1) — same naming/placement
 * convention `adapters/workspace/lock-holder-env.ts` already established for
 * `SEEYA_LOCK_HOLDER_PID`/`SEEYA_LOCK_HOLDER_PROC_START`: the constant lives next to whoever WRITES
 * the real environment (`buildManifestWriteEnv`, called from `commit.ts#commitAll`), and the
 * composition root that reads it back for `seeya project verify-commit`
 * (`packages/cli/src/composition.ts#buildVerifyCommitDeps`) imports the same name by its public
 * subpath, never redeclaring the string.
 *
 * `commitAll`'s own legitimate callers (four at V2-T73, six since V2-T84) —
 * `application/workspace.ts#createProject`, `application/repository-association.ts#addRepository`,
 * `application/project-remove-repo.ts`, `application/project-remove.ts` and
 * `application/project-archive.ts` (`archiveProject`/`unarchiveProject`) — pass `manifestWriteAuthorized: true`; every other caller (the
 * leftover-changes commit inside `application/project-open.ts`, the adoption's own commit inside
 * `application/project-adopt-outcome.ts`) omits it, since NEITHER of those is a place seeya itself
 * would ever legitimately change `seeya.json` — a session's own edit riding along in either commit
 * is exactly what `core/workspace-commit-guard.ts`'s new check has to catch (item 1's own "caso
 * proibido").
 */
export const MANIFEST_WRITE_AUTHORIZED_ENV_VAR = 'SEEYA_MANIFEST_WRITE_AUTHORIZED';

/**
 * The env object to spread on TOP of a `git commit`'s own spawn env — empty when
 * `manifestWriteAuthorized` is falsy, same "empty object, not an unset key" shape
 * `lock-holder-env.ts#buildLockHolderEnv` already uses for its own `undefined` case.
 *
 * @example
 * buildManifestWriteEnv(true) // { SEEYA_MANIFEST_WRITE_AUTHORIZED: '1' }
 * buildManifestWriteEnv(false) // {}
 */
export function buildManifestWriteEnv(manifestWriteAuthorized: boolean): NodeJS.ProcessEnv {
  return manifestWriteAuthorized ? { [MANIFEST_WRITE_AUTHORIZED_ENV_VAR]: '1' } : {};
}

/**
 * The read side, for `packages/cli/src/composition.ts#buildVerifyCommitDeps` (the workspace's own
 * `commit-msg` hook's one caller) — `true` only for the exact literal `'1'` `buildManifestWriteEnv`
 * writes above, never inferred from mere presence (a forged empty string wouldn't authorize
 * anything, same defensive parsing `lock-holder-env.ts#readLockHolderProcess` applies to its own
 * pair).
 *
 * @example
 * readManifestWriteAuthorized({ SEEYA_MANIFEST_WRITE_AUTHORIZED: '1' }) // true
 * readManifestWriteAuthorized({}) // false
 */
export function readManifestWriteAuthorized(env: NodeJS.ProcessEnv): boolean {
  return env[MANIFEST_WRITE_AUTHORIZED_ENV_VAR] === '1';
}
