import { rm } from 'node:fs/promises';

/**
 * The one way a test removes a temporary directory a real child process (`git`, the compiled CLI,
 * a fake `claude`, a test daemon) may have touched (V2-T85). On Windows the OS can keep a handle
 * on a directory — a process `cwd`, a `.git/index` a git still has open — for a few milliseconds
 * after that process's `close` event, or for as long as a process abandoned by a timed-out test
 * keeps running (vitest does not cancel the test's await chain): a plain `rm` then fails with
 * `EBUSY`/`ENOTEMPTY` and turns one slow test into a second, unrelated-looking failure.
 * `maxRetries`/`retryDelay` is `fs.rm`'s own documented mechanism for exactly this (precedent:
 * `tests/e2e/_harness.ts#removeE2eHome`, observed there as a real `EBUSY`) — never a hand-rolled
 * sleep loop. 5 x 100ms backs off up to ~0.5s: enough for the handle-release lag measured, not a
 * way to wait out a process that never exits (that would still fail, loudly, as it should).
 */
export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
