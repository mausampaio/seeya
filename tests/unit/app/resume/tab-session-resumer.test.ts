import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { RESUME_PROMPT_ARG_LIMIT_CHARS } from '@seeya-ai/engine/adapters/resumption/args.js';
import {
  raceExitAgainstGrace,
  TabSessionResumer,
  type OpenedResumeTab,
  type TabResumeOpener,
} from '../../../../packages/app/src/resume/tab-session-resumer.js';

/** Instant `sleep` — same shape `tests/unit/app/state/refresh-loop.test.ts` already uses. Safe to
 * reuse for BOTH "survives the grace period" and "exits before it" cases below: `FakeOpener`'s own
 * `triggerExit` resolves the race synchronously, before this promise's `.then()` ever gets a
 * chance to run (see this file's own comment on `attemptResume`'s "exits fast" test). */
class FakeClock implements Clock {
  now(): Date {
    return new Date('2026-01-01T00:00:00.000Z');
  }
  sleep(): Promise<void> {
    return Promise.resolve();
  }
}

/** A named double implementing `TabResumeOpener` (AGENTS.md § "Testes": "duplo de I/O é classe
 * nomeada") — records every `openTab` call and lets the test fire a registered tab's exit on
 * demand, standing in for a real pty ever actually running. */
class FakeOpener implements TabResumeOpener {
  readonly openedTabs: Array<{
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
  }> = [];
  private readonly listeners = new Map<string, (exitCode: number) => void>();
  private nextId = 0;

  openTab(options: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
  }): Promise<OpenedResumeTab> {
    this.openedTabs.push(options);
    this.nextId += 1;
    return Promise.resolve({ id: `tab-${this.nextId}`, pid: 1000 + this.nextId });
  }

  onceExit(id: string, listener: (exitCode: number) => void): void {
    this.listeners.set(id, listener);
  }

  /** Fires `id`'s registered exit listener right away — used synchronously, right after the call
   * that registered it, so it always wins the race against `FakeClock`'s instantly-resolved
   * `sleep` (the exit resolution runs before any microtask from `sleep().then()` gets a chance to
   * run at all). */
  triggerExit(id: string, exitCode: number): void {
    this.listeners.get(id)?.(exitCode);
  }
}

describe('raceExitAgainstGrace', () => {
  it('resolves "survivedGrace" when nobody fires the tab exit before the clock sleep resolves', async () => {
    const opener = new FakeOpener();
    const clock = new FakeClock();

    const result = await raceExitAgainstGrace(opener, clock, 5_000, 'tab-1');

    expect(result).toEqual({ kind: 'survivedGrace' });
  });

  it('resolves "exited" with the exit code when the tab exits before the grace period', async () => {
    const opener = new FakeOpener();
    const clock = new FakeClock();

    const resultPromise = raceExitAgainstGrace(opener, clock, 5_000, 'tab-1');
    opener.triggerExit('tab-1', 1);
    const result = await resultPromise;

    expect(result).toEqual({ kind: 'exited', exitCode: 1 });
  });

  it('a late exit, after the race already settled, changes nothing (never throws)', async () => {
    const opener = new FakeOpener();
    const clock = new FakeClock();

    const result = await raceExitAgainstGrace(opener, clock, 5_000, 'tab-1');
    expect(() => opener.triggerExit('tab-1', 1)).not.toThrow();
    expect(result).toEqual({ kind: 'survivedGrace' });
  });
});

describe('TabSessionResumer#attemptResume', () => {
  const labelFor = (sessionId: string): string => `label-for-${sessionId}`;

  it('never opens a tab when the prompt exceeds the size threshold', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome: '/unused',
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: labelFor,
    });
    const oversized = 'x'.repeat(RESUME_PROMPT_ARG_LIMIT_CHARS + 1);

    const result = await resumer.attemptResume('session-1', '/cwd', oversized);

    expect(result).toEqual({
      kind: 'needsFallback',
      reason: {
        kind: 'promptTooLarge',
        promptLength: oversized.length,
        limitChars: RESUME_PROMPT_ARG_LIMIT_CHARS,
      },
    });
    expect(opener.openedTabs).toHaveLength(0);
  });

  it('opens a tab with buildResumeArgs, labeled via resolveLabel, and reports "resumed" once it survives the grace window', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome: '/unused',
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: labelFor,
    });

    const result = await resumer.attemptResume('session-1', '/project', "yesterday's plan");

    expect(result).toEqual({
      kind: 'resumed',
      outcome: { sessionId: 'session-1', cwd: '/project', kind: 'resumed' },
    });
    expect(opener.openedTabs).toEqual([
      {
        command: 'claude',
        args: ['--resume', 'session-1', "yesterday's plan"],
        cwd: '/project',
        label: 'label-for-session-1',
      },
    ]);
  });

  it('reports "needsFallback" with the exit code when the tab exits fast with a non-zero code', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome: '/unused',
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: labelFor,
    });

    const resultPromise = resumer.attemptResume('session-1', '/project', 'a plan');
    // The tab id is deterministic (FakeOpener's own counter) — attemptResume awaits openTab
    // before racing, so by the time this line runs the exit listener is already registered.
    await Promise.resolve();
    opener.triggerExit('tab-1', 17);
    const result = await resultPromise;

    expect(result).toEqual({
      kind: 'needsFallback',
      reason: { kind: 'resumeFailed', exitCode: 17 },
    });
  });

  it('a fast exit with code 0 still counts as "resumed" (mirrors ClaudeSessionResumer#isFastFailure: exitCode !== 0 is required)', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome: '/unused',
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: labelFor,
    });

    const resultPromise = resumer.attemptResume('session-1', '/project', 'a plan');
    await Promise.resolve();
    opener.triggerExit('tab-1', 0);
    const result = await resultPromise;

    expect(result).toEqual({
      kind: 'resumed',
      outcome: { sessionId: 'session-1', cwd: '/project', kind: 'resumed' },
    });
  });
});

describe('TabSessionResumer#resumeWithoutPrompt (V2-T7)', () => {
  const labelFor = (sessionId: string): string => `label-for-${sessionId}`;

  it('opens a tab with buildResumeWithoutPromptArgs (no prompt) and reports bare "resumed" once it survives the grace window', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome: '/unused',
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: labelFor,
    });

    const result = await resumer.resumeWithoutPrompt('session-1', '/project');

    expect(result).toEqual({
      kind: 'resumed',
      outcome: { sessionId: 'session-1', cwd: '/project', kind: 'resumed' },
    });
    expect(opener.openedTabs).toEqual([
      {
        command: 'claude',
        args: ['--resume', 'session-1'],
        cwd: '/project',
        label: 'label-for-session-1',
      },
    ]);
  });

  it('reports "needsFallback" with resumeWithoutPlanFailed and the exit code when the tab exits fast with a non-zero code', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome: '/unused',
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: labelFor,
    });

    const resultPromise = resumer.resumeWithoutPrompt('session-1', '/project');
    await Promise.resolve();
    opener.triggerExit('tab-1', 9);
    const result = await resultPromise;

    expect(result).toEqual({
      kind: 'needsFallback',
      reason: { kind: 'resumeWithoutPlanFailed', exitCode: 9 },
    });
  });
});

describe('TabSessionResumer#runFallback', () => {
  let seeyaHome: string;

  beforeEach(async () => {
    seeyaHome = await mkdtemp(path.join(tmpdir(), 'seeya-app-resumer-'));
  });

  afterEach(async () => {
    await rm(seeyaHome, { recursive: true, force: true });
  });

  it('writes the context file, opens a tab with buildFallbackArgs, and returns immediately (never waits for exit)', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome,
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: (sessionId) => `label-for-${sessionId}`,
    });
    const reason = { kind: 'resumeFailed' as const, exitCode: 1 };

    const outcome = await resumer.runFallback('session-1', '/project', 'the plan', reason);

    expect(outcome).toEqual({
      sessionId: 'session-1',
      cwd: '/project',
      kind: 'freshSession',
      reason,
    });
    expect(opener.openedTabs).toHaveLength(1);
    expect(opener.openedTabs[0]?.args[0]).toBe('--append-system-prompt-file');
    expect(opener.openedTabs[0]?.label).toBe('label-for-session-1');
    // The scratch file exists right after runFallback returns — cleanup only happens on exit,
    // never before (this method's own docstring: it can't wait for a session it never waits on).
    const tmpEntriesBeforeExit = await readdir(path.join(seeyaHome, 'tmp'));
    expect(tmpEntriesBeforeExit).toHaveLength(1);
  });

  it('removes the scratch file once the fallback tab eventually exits', async () => {
    const opener = new FakeOpener();
    const resumer = new TabSessionResumer({
      seeyaHome,
      claudeCommand: 'claude',
      opener,
      clock: new FakeClock(),
      resolveLabel: (sessionId) => sessionId,
    });
    const reason = { kind: 'resumeFailed' as const, exitCode: 1 };

    await resumer.runFallback('session-1', '/project', 'the plan', reason);
    opener.triggerExit('tab-1', 0);
    // removeFallbackContextFile is async — let its promise settle before checking the directory.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const tmpEntriesAfterExit = await readdir(path.join(seeyaHome, 'tmp'));
    expect(tmpEntriesAfterExit).toHaveLength(0);
  });
});
