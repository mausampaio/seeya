/**
 * `SessionAdoptionLauncher`'s only implementation (V2-T29, `core/ports.ts`) — resumes an existing
 * session into a fork, interactively, in the fork's own directory, with the project released via
 * `--add-dir`. Reuses `adapters/resumption/spawn-interactive.ts#runInteractive` and
 * `env.ts#buildResumptionEnv` (D-017), the same pair `adapters/harness/index.ts
 * #ClaudeHarnessLauncher` already reuses for `open` — never headless, per D-047's own reasoning
 * for choosing interactive, on-the-spot approval over any `--permission-mode` flag.
 */
import type { HarnessOpenResult, SessionAdoptionLauncher } from '../../core/ports.js';
import { runInteractive } from '../resumption/spawn-interactive.js';
import { buildResumptionEnv } from '../resumption/env.js';
import { buildAdoptArgs } from './adopt-args.js';

const DEFAULT_CLAUDE_BINARY = 'claude';

export interface ClaudeSessionAdoptionLauncherOptions {
  /** Overridable for tests — mirrors `ClaudeHarnessLauncherOptions.claudeBinary`. */
  readonly claudeBinary?: string;
}

export class ClaudeSessionAdoptionLauncher implements SessionAdoptionLauncher {
  constructor(private readonly options: ClaudeSessionAdoptionLauncherOptions = {}) {}

  async adopt(
    originalCwd: string,
    addDirs: readonly string[],
    originalSessionId: string,
    forkSessionId: string,
  ): Promise<HarnessOpenResult> {
    const claudeBinary = this.options.claudeBinary ?? DEFAULT_CLAUDE_BINARY;
    const result = await runInteractive({
      claudeBinary,
      args: buildAdoptArgs(originalSessionId, forkSessionId, addDirs),
      cwd: originalCwd,
      env: buildResumptionEnv(process.env),
    });
    // Same sentinel `ClaudeHarnessLauncher.open` already documents: a spawn that never started at
    // all (`exitCode: -1, failedFast: true`) is the one case this port judges; every other close is
    // a genuine attempt this port has no business calling a failure.
    if (result.failedFast && result.exitCode === -1) {
      return { kind: 'failedToStart' };
    }
    return { kind: 'opened', exitCode: result.exitCode };
  }
}
