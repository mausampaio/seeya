/**
 * V2-T13 (D-045 item 1): applies the person's answer to the ownership-transition dialog — pure
 * orchestration over already-injected functions/ports, pulled out of
 * `composition/index.ts#buildAppContext` so the `'accepted'` branch's own call ORDER (stop the
 * CLI's daemon, THEN repoint autostart at the app, THEN start the app's own daemon) is provable
 * without ever touching a real OS autostart mechanism — AGENTS.md: no agent may register/remove
 * the real `seeya`/`seeya-dev` autostart entry, and `buildAppContext`'s own `enableAppAutostart`/
 * `startDaemon`/`stopDaemon` are hard-wired to real adapters with no seam of their own to fake.
 * Every dependency here is a plain function/port method instead, faked in
 * `tests/unit/app/composition/daemon-ownership-transition.test.ts`.
 *
 * **Why `'declined'` still writes, not just skips.** `Storage.saveDaemonOwnershipTransitionAnswer`
 * is what `checkDaemonOwnershipTransitionOffer` reads back to stop asking a second time (D-045's
 * own "recusando: não pergunta de novo") — an answer that isn't persisted would offer the dialog
 * again on the very next window open, which is a worse outcome than the `'accepted'` case ever
 * failing partway (D-045 doesn't ask for transactional rollback across stop/enable/start, only
 * "ask once").
 */
import type { AutostartEnableResult, Storage } from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwnershipTransitionAnswer } from '@seeya-ai/engine/core/types.js';

export interface DaemonOwnershipTransitionDeps {
  readonly storage: Pick<Storage, 'saveDaemonOwnershipTransitionAnswer'>;
  readonly stopDaemon: () => Promise<string>;
  readonly enableAppAutostart: () => Promise<AutostartEnableResult>;
  readonly startDaemon: () => Promise<string>;
}

/**
 * @example
 * await applyDaemonOwnershipTransition('accepted', {
 *   storage,
 *   stopDaemon: context.stopDaemon,
 *   enableAppAutostart: context.enableAppAutostart,
 *   startDaemon: context.startDaemon,
 * });
 * // -> the CLI's daemon (if any) is stopped, autostart now points at the app, the app's own
 * //    daemon is running, and the answer is persisted so this never runs again on this machine.
 */
export async function applyDaemonOwnershipTransition(
  answer: DaemonOwnershipTransitionAnswer,
  deps: DaemonOwnershipTransitionDeps,
): Promise<void> {
  if (answer === 'accepted') {
    await deps.stopDaemon();
    await deps.enableAppAutostart();
    await deps.startDaemon();
  }
  await deps.storage.saveDaemonOwnershipTransitionAnswer(answer);
}
