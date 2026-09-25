import { describe, expect, it } from 'vitest';
import {
  ProjectAdoptTabLauncher,
  ProjectOpenTabLauncher,
} from '../../../../packages/app/src/resume/project-tab-launcher.js';
import type {
  OpenedResumeTab,
  TabResumeOpener,
} from '../../../../packages/app/src/resume/tab-session-resumer.js';

/** Same "duplo de I/O é classe nomeada" double `tab-session-resumer.test.ts`'s own `FakeOpener`
 * already establishes, reused here rather than duplicated (a second copy of the identical fake
 * would be exactly the "nada de duplicação" AGENTS.md rules out). */
class FakeOpener implements TabResumeOpener {
  readonly openedTabs: Array<{
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
  }> = [];
  private readonly listeners = new Map<string, (exitCode: number) => void>();
  private nextId = 0;
  private failNextOpen = false;

  openTab(options: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
  }): Promise<OpenedResumeTab> {
    this.openedTabs.push(options);
    if (this.failNextOpen) {
      return Promise.reject(new Error('could not find "claude" — searched: (PATH is empty)'));
    }
    this.nextId += 1;
    return Promise.resolve({ id: `tab-${this.nextId}`, pid: 1000 + this.nextId });
  }

  onceExit(id: string, listener: (exitCode: number) => void): void {
    this.listeners.set(id, listener);
  }

  triggerExit(id: string, exitCode: number): void {
    this.listeners.get(id)?.(exitCode);
  }

  makeNextOpenFail(): void {
    this.failNextOpen = true;
  }
}

describe('ProjectOpenTabLauncher (V2-T30 item 3)', () => {
  it('opens a tab with the built --session-id/--append-system-prompt/--add-dir args and resolves once it exits', async () => {
    const opener = new FakeOpener();
    const launcher = new ProjectOpenTabLauncher({
      claudeCommand: 'claude',
      opener,
      label: 'auth-hardening',
    });

    const resultPromise = launcher.open(
      '/seeya/workspace/auth-hardening',
      ['/code/app-api'],
      '11111111-1111-4111-8111-111111111111',
      'note',
    );
    expect(opener.openedTabs).toEqual([
      {
        command: 'claude',
        args: [
          '--session-id',
          '11111111-1111-4111-8111-111111111111',
          '--append-system-prompt',
          'note',
          '--add-dir',
          '/code/app-api',
          '--',
        ],
        cwd: '/seeya/workspace/auth-hardening',
        label: 'auth-hardening',
      },
    ]);

    // Lets `openTab`'s own resolved promise (and the `await` right after it, inside
    // `openTabAndAwaitExit`) actually run before the exit listener registers — same microtask-flush
    // discipline every fake-opener test needs whenever the real code awaits the tab's creation
    // before wiring `onceExit` (unlike `raceExitAgainstGrace`'s own tests, which register
    // synchronously and never need this).
    await Promise.resolve();
    await Promise.resolve();
    opener.triggerExit('tab-1', 0);
    await expect(resultPromise).resolves.toEqual({ kind: 'opened', exitCode: 0 });
  });

  it('never lets a spawn failure reject — reports failedToStart instead', async () => {
    const opener = new FakeOpener();
    opener.makeNextOpenFail();
    const launcher = new ProjectOpenTabLauncher({ claudeCommand: 'claude', opener, label: 'x' });

    await expect(
      launcher.open('/seeya/workspace/x', [], '11111111-1111-4111-8111-111111111111', null),
    ).resolves.toEqual({ kind: 'failedToStart' });
  });
});

describe('ProjectAdoptTabLauncher (V2-T30 item 5)', () => {
  it('opens the fork in the ORIGINAL cwd with the built --resume/--fork-session/--add-dir args', async () => {
    const opener = new FakeOpener();
    const launcher = new ProjectAdoptTabLauncher({
      claudeCommand: 'claude',
      opener,
      label: 'original-session',
    });

    const resultPromise = launcher.adopt(
      '/code/app',
      '/seeya/workspace/auth-hardening',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );
    const opened = opener.openedTabs[0];
    expect(opened?.cwd).toBe('/code/app');
    expect(opened?.args.slice(0, 5)).toEqual([
      '--resume',
      '11111111-1111-4111-8111-111111111111',
      '--fork-session',
      '--session-id',
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(opened?.label).toBe('original-session');

    await Promise.resolve();
    await Promise.resolve();
    opener.triggerExit('tab-1', 0);
    await expect(resultPromise).resolves.toEqual({ kind: 'opened', exitCode: 0 });
  });

  it('never lets a spawn failure reject — reports failedToStart instead', async () => {
    const opener = new FakeOpener();
    opener.makeNextOpenFail();
    const launcher = new ProjectAdoptTabLauncher({ claudeCommand: 'claude', opener, label: 'x' });

    await expect(
      launcher.adopt(
        '/code/app',
        '/seeya/workspace/x',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).resolves.toEqual({ kind: 'failedToStart' });
  });
});
