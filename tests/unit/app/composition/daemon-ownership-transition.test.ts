/**
 * `packages/app/src/composition/daemon-ownership-transition.ts` (V2-T13, D-045 item 1). Every
 * dependency is a named double — never a real OS autostart mechanism (AGENTS.md: no agent may
 * register/remove the real `seeya`/`seeya-dev` autostart entry).
 */
import { describe, expect, it } from 'vitest';
import { applyDaemonOwnershipTransition } from '../../../../packages/app/src/composition/daemon-ownership-transition.js';
import type { AutostartEnableResult, Storage } from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwnershipTransitionAnswer } from '@seeya-ai/engine/core/types.js';

/** Records the order every dependency was called in, and what answer (if any) got persisted —
 * enough to prove both the call order (stop, then enable, then start) and that `'declined'` never
 * calls any of the three daemon/autostart functions at all. */
class RecordingDeps {
  readonly calls: string[] = [];
  savedAnswer: DaemonOwnershipTransitionAnswer | undefined;

  readonly storage: Pick<Storage, 'saveDaemonOwnershipTransitionAnswer'> = {
    saveDaemonOwnershipTransitionAnswer: (answer) => {
      this.savedAnswer = answer;
      this.calls.push('save');
      return Promise.resolve();
    },
  };

  stopDaemon = (): Promise<string> => {
    this.calls.push('stop');
    return Promise.resolve('stopped');
  };

  enableAppAutostart = (): Promise<AutostartEnableResult> => {
    this.calls.push('enable');
    return Promise.resolve({ kind: 'registered', path: 'C:\\seeya\\dist\\cli\\index.js' });
  };

  startDaemon = (): Promise<string> => {
    this.calls.push('start');
    return Promise.resolve('started');
  };
}

describe('applyDaemonOwnershipTransition', () => {
  it('"accepted": stops the CLI daemon, THEN repoints autostart, THEN starts the app daemon, THEN saves', async () => {
    const deps = new RecordingDeps();

    await applyDaemonOwnershipTransition('accepted', deps);

    expect(deps.calls).toEqual(['stop', 'enable', 'start', 'save']);
    expect(deps.savedAnswer).toBe('accepted');
  });

  it('"declined": only persists the answer — never touches stopDaemon/enableAppAutostart/startDaemon', async () => {
    const deps = new RecordingDeps();

    await applyDaemonOwnershipTransition('declined', deps);

    expect(deps.calls).toEqual(['save']);
    expect(deps.savedAnswer).toBe('declined');
  });
});
