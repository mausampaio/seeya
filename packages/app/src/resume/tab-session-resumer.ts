/**
 * `SessionResumer` (`@seeya-ai/engine/core/ports.js`) implemented over a tab instead of the CLI's
 * inherited terminal (V2-T4, D-042/D-043 — the reason two composition roots exist: "a mesma
 * `resumeSessions` da CLI, com um `SessionResumer` diferente"). Same argument shape
 * (`buildResumeArgs`/`buildFallbackArgs`), same size ceiling (`RESUME_PROMPT_ARG_LIMIT_CHARS`), same
 * fallback context file (`context-file.ts`) — every one of those reused directly from the engine,
 * never re-implemented, so a change to any of them (the S5-T9 teto, say) never has to be made twice.
 *
 * **What actually differs from `adapters/resumption/resumer.ts#ClaudeSessionResumer`: how the
 * process is launched and watched.** The CLI's version hands the child the real terminal and waits
 * for it to close (`spawn-interactive.ts`, `stdio: 'inherit'`) — this one opens a tab and NEVER
 * waits for the session to end (D-039: the interface doesn't own how long someone stays in a
 * session). `attemptResume` only waits up to `fastFailureGraceMs` to decide "resumed" vs.
 * "needsFallback", racing the tab's own exit against `clock.sleep(graceMs)` — through the injected
 * `Clock` (V2-T4's own cuidado), not `spawn-interactive.ts`'s `AbortSignal.timeout`, precisely so
 * this race is testable with a fake `Clock` and a fake `TabResumeOpener`, no real 5-second wait and
 * no real pty anywhere in the test.
 */
import type { Clock, SessionResumer } from '@seeya-ai/engine/core/ports.js';
import type {
  PrimaryResumeAttempt,
  ResumeFallbackReason,
  ResumeOutcome,
} from '@seeya-ai/engine/core/types.js';
import {
  buildFallbackArgs,
  buildResumeArgs,
  RESUME_PROMPT_ARG_LIMIT_CHARS,
} from '@seeya-ai/engine/adapters/resumption/args.js';
import { FAST_FAILURE_GRACE_MS } from '@seeya-ai/engine/adapters/resumption/spawn-interactive.js';
import {
  removeFallbackContextFile,
  writeFallbackContextFile,
} from '@seeya-ai/engine/adapters/resumption/context-file.js';

/** One tab opened for a resume attempt — just enough to key the exit registry and mark the pty
 * record (`tabs/tab-model.ts#withPid`) by. */
export interface OpenedResumeTab {
  readonly id: string;
  readonly pid: number;
}

/**
 * What `TabSessionResumer` needs to open a tab and learn about its exit. Implemented for real in
 * `electron/main.ts` (glue over its own `PtyManager`/`TabCollection`/`ExitListenerRegistry` — it
 * cannot run outside a real Electron process the same way the rest of `electron/` can't, so it's
 * never unit-tested directly, same exclusion as `wireIpc` itself), and by a fake in this module's
 * own tests.
 */
export interface TabResumeOpener {
  /**
   * Opens a tab labeled `label` (the handoff's `name`, never the raw `claude`/`codex` command —
   * V2-T4's own "a aba ... rotulada com o nome da sessão"), resolving once the pty has actually
   * spawned and been assigned a pid.
   */
  openTab(options: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
  }): Promise<OpenedResumeTab>;
  /** One-shot: fires at most once, whenever `id`'s tab process actually ends, however long that
   * takes (`ExitListenerRegistry`, the real implementation's own module). */
  onceExit(id: string, listener: (exitCode: number) => void): void;
}

export interface TabSessionResumerOptions {
  /** Root standing in for `~/.seeya` — where the fallback's scratch file lives (`context-file.ts`),
   * same as `ClaudeSessionResumerOptions.seeyaHome`. */
  readonly seeyaHome: string;
  /** The command name to resolve — `'claude'` in production; the real `TabResumeOpener` resolves it
   * against the real `PATH` (`adapters/process/resolve-command.js`), the same way `electron/main.ts`
   * already resolves a command-bar-typed harness. Overridable for tests. */
  readonly claudeCommand: string;
  readonly opener: TabResumeOpener;
  readonly clock: Clock;
  /**
   * `SessionResumer.attemptResume`/`runFallback` only ever receive `sessionId`/`cwd`/`prompt` —
   * `core/ports.ts`'s own signature, shared with the CLI's `ClaudeSessionResumer`, has no `name`
   * field to label a tab with. V2-T4's own "a aba ... rotulada com o nome da sessão do handoff"
   * needs one anyway, so the caller (`electron/main.ts`, which already has the full list of
   * handoffs a "Resume selected" click is about to resume) supplies this lookup once per click.
   * Falls back to the raw `sessionId` for one this resumer wasn't told a name for, rather than
   * throwing over a label — the tab still opens either way.
   */
  readonly resolveLabel: (sessionId: string) => string;
  /** Overridable for tests — defaults to the engine's own `FAST_FAILURE_GRACE_MS`, the same 5s
   * window `ClaudeSessionResumer` uses (V2-T4: "mesmo teto `FAST_FAILURE_GRACE_MS`"). */
  readonly fastFailureGraceMs?: number;
}

type RaceResult =
  { readonly kind: 'exited'; readonly exitCode: number } | { readonly kind: 'survivedGrace' };

/**
 * The fast-failure race itself, pure given `opener`/`clock` — exported so it can be exercised
 * directly, one call at a time, without going through the whole `SessionResumer` interface.
 *
 * @example
 * const raced = await raceExitAgainstGrace(fakeOpener, fakeClock, 5_000, 'tab-1');
 * // { kind: 'survivedGrace' } once fakeClock's sleep(5000) resolves first, or
 * // { kind: 'exited', exitCode } if fakeOpener fires the tab's exit first
 */
export function raceExitAgainstGrace(
  opener: TabResumeOpener,
  clock: Clock,
  graceMs: number,
  tabId: string,
): Promise<RaceResult> {
  return new Promise((resolve) => {
    let settled = false;
    opener.onceExit(tabId, (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ kind: 'exited', exitCode });
    });
    void clock.sleep(graceMs).then(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ kind: 'survivedGrace' });
    });
  });
}

export class TabSessionResumer implements SessionResumer {
  constructor(private readonly options: TabSessionResumerOptions) {}

  /**
   * Mirrors `ClaudeSessionResumer#attemptResume`'s two branches exactly (same size ceiling, same
   * "exited fast with a non-zero code" rule — `spawn-interactive.ts#isFastFailure`'s own reasoning,
   * reused here through the race result instead of `InteractiveRunResult`), the one difference
   * being that a "resumed" outcome here means "the tab is open and still running after the grace
   * window", never "the session ended" — this method returns long before that could happen.
   */
  async attemptResume(
    sessionId: string,
    cwd: string,
    prompt: string,
  ): Promise<PrimaryResumeAttempt> {
    if (prompt.length > RESUME_PROMPT_ARG_LIMIT_CHARS) {
      return {
        kind: 'needsFallback',
        reason: {
          kind: 'promptTooLarge',
          promptLength: prompt.length,
          limitChars: RESUME_PROMPT_ARG_LIMIT_CHARS,
        },
      };
    }
    const graceMs = this.options.fastFailureGraceMs ?? FAST_FAILURE_GRACE_MS;
    const tab = await this.options.opener.openTab({
      command: this.options.claudeCommand,
      args: buildResumeArgs(sessionId, prompt),
      cwd,
      label: this.options.resolveLabel(sessionId),
    });
    const raced = await raceExitAgainstGrace(
      this.options.opener,
      this.options.clock,
      graceMs,
      tab.id,
    );
    if (raced.kind === 'exited' && raced.exitCode !== 0) {
      return { kind: 'needsFallback', reason: { kind: 'resumeFailed', exitCode: raced.exitCode } };
    }
    return { kind: 'resumed', outcome: { sessionId, cwd, fellBack: false } };
  }

  /**
   * Only ever called after the caller (`application/start-day.ts#resumeSessions`) decided to open
   * it — after asking the person, via the app's own `FallbackConfirmer` (V2-T4 item 3). Opens the
   * fallback tab and returns immediately: never waits for it either, same "the app never waits on a
   * session" discipline as `attemptResume` above.
   *
   * **Cleanup timing deliberately differs from the CLI's.** `ClaudeSessionResumer#runFallback`
   * removes the scratch file in a `finally`, right after its own `runInteractive` call resolves —
   * which only happens once the whole session has ended, because that call WAITS for it. This
   * method has no such wait to hang cleanup off of, so it hangs it off the tab's own eventual exit
   * instead (`opener.onceExit`): the file is guaranteed to have already been read by `claude` by
   * then, whenever "then" turns out to be, and removal is still best-effort/ENOENT-tolerant, same
   * as `removeFallbackContextFile` always was.
   */
  async runFallback(
    sessionId: string,
    cwd: string,
    prompt: string,
    reason: ResumeFallbackReason,
  ): Promise<ResumeOutcome> {
    const contextFilePath = await writeFallbackContextFile(
      this.options.seeyaHome,
      sessionId,
      prompt,
    );
    const tab = await this.options.opener.openTab({
      command: this.options.claudeCommand,
      args: buildFallbackArgs(contextFilePath),
      cwd,
      label: this.options.resolveLabel(sessionId),
    });
    this.options.opener.onceExit(tab.id, () => {
      void removeFallbackContextFile(contextFilePath);
    });
    return { sessionId, cwd, fellBack: reason };
  }
}
