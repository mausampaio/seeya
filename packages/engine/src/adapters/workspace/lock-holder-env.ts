/**
 * The two environment variables that carry a `LockHolderProcess` (`core/lock-holder-process.ts`)
 * across the `git commit` process boundary (V2-T34 hotfix, PO review 2026-09-25) — same naming
 * convention `adapters/process/daemon-launch.ts#DAEMON_CHILD_ENV_VAR` already established for a
 * seeya-internal marker: the constant lives next to whoever WRITES the real environment
 * (`buildLockHolderEnv`, called from `index.ts#commitAll`/`revert.ts#revertCommitSequence` when
 * committing while holding the project's own lock), and the composition root that reads it back
 * for `seeya project verify-commit` (`packages/cli/src/composition.ts#buildVerifyCommitDeps`)
 * imports the same names by its public subpath, never redeclaring the strings.
 */
import type { LockHolderProcess } from '../../core/lock-holder-process.js';

export const LOCK_HOLDER_PID_ENV_VAR = 'SEEYA_LOCK_HOLDER_PID';
export const LOCK_HOLDER_PROC_START_ENV_VAR = 'SEEYA_LOCK_HOLDER_PROC_START';

/**
 * The env object to spread on TOP of a `git commit`'s own spawn env — empty when `lockHolder` is
 * `undefined` (an ordinary commit `seeya` isn't making while holding the touched project's lock).
 *
 * @example
 * buildLockHolderEnv({ pid: 4242, procStart: '12345' })
 * // { SEEYA_LOCK_HOLDER_PID: '4242', SEEYA_LOCK_HOLDER_PROC_START: '12345' }
 * buildLockHolderEnv(undefined)
 * // {}
 */
export function buildLockHolderEnv(lockHolder: LockHolderProcess | undefined): NodeJS.ProcessEnv {
  if (lockHolder === undefined) {
    return {};
  }
  return {
    [LOCK_HOLDER_PID_ENV_VAR]: String(lockHolder.pid),
    ...(lockHolder.procStart !== undefined
      ? { [LOCK_HOLDER_PROC_START_ENV_VAR]: lockHolder.procStart }
      : {}),
  };
}

/**
 * The read side, for a composition root (`packages/cli/src/composition.ts#buildVerifyCommitDeps`,
 * the workspace's own `commit-msg` hook's one caller). `undefined` when `SEEYA_LOCK_HOLDER_PID` is
 * missing or doesn't parse as a positive integer (D-025: never a guessed identity from malformed
 * input) — `SEEYA_LOCK_HOLDER_PROC_START` alone, without a valid pid, names nothing on its own.
 *
 * @example
 * readLockHolderProcess({ SEEYA_LOCK_HOLDER_PID: '4242', SEEYA_LOCK_HOLDER_PROC_START: '12345' })
 * // { pid: 4242, procStart: '12345' }
 * readLockHolderProcess({})
 * // undefined
 */
export function readLockHolderProcess(env: NodeJS.ProcessEnv): LockHolderProcess | undefined {
  const rawPid = env[LOCK_HOLDER_PID_ENV_VAR];
  if (rawPid === undefined) {
    return undefined;
  }
  const pid = Number.parseInt(rawPid, 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    return undefined;
  }
  return { pid, procStart: env[LOCK_HOLDER_PROC_START_ENV_VAR] };
}
