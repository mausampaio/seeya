/**
 * `HarnessLauncher`'s only implementation (V2-T28, `core/ports.ts`) — opens `claude` fresh in a
 * project's directory, `--add-dir` per associated repository still resolvable on this device.
 * Reuses `adapters/resumption/spawn-interactive.ts#runInteractive` (the one place in this project
 * that already spawns `claude` with `stdio: 'inherit'`, per docs/spikes/H-retomada-interativa.md's
 * own measurement that only a real terminal gets a genuine interactive session) and
 * `adapters/resumption/env.ts#buildResumptionEnv` (D-017's sanitization) rather than duplicating
 * either — adapter-to-adapter imports are allowed by the layer matrix (docs/ARQUITETURA.md; only
 * `application/`, `cli/` and `scheduler/` are restricted from `adapters/`).
 */
import type { HarnessLauncher, HarnessOpenResult } from '../../core/ports.js';
import { runInteractive } from '../resumption/spawn-interactive.js';
import { buildResumptionEnv } from '../resumption/env.js';
import { buildOpenArgs } from './args.js';

const DEFAULT_CLAUDE_BINARY = 'claude';

export interface ClaudeHarnessLauncherOptions {
  /** Overridable for tests — points at a fake `claude` script instead of resolving the real
   * binary via `PATH` (mirrors `ClaudeSessionResumerOptions.claudeBinary`). */
  readonly claudeBinary?: string;
}

export class ClaudeHarnessLauncher implements HarnessLauncher {
  constructor(private readonly options: ClaudeHarnessLauncherOptions = {}) {}

  async open(
    cwd: string,
    addDirs: readonly string[],
    sessionId: string,
    systemPromptAppend: string | null,
  ): Promise<HarnessOpenResult> {
    const claudeBinary = this.options.claudeBinary ?? DEFAULT_CLAUDE_BINARY;
    const result = await runInteractive({
      claudeBinary,
      args: buildOpenArgs(addDirs, sessionId, systemPromptAppend),
      cwd,
      env: buildResumptionEnv(process.env),
    });
    // `spawn-interactive.ts#InteractiveRunResult`'s own docstring: a spawn that never starts at
    // all (missing binary, missing `cwd`) is reported as `exitCode: -1, failedFast: true` — the
    // one sentinel this port cares about. Every other close (fast or slow, any real exit code) is
    // a genuine session that ran, never a "failure" this port has any business judging.
    if (result.failedFast && result.exitCode === -1) {
      return { kind: 'failedToStart' };
    }
    return { kind: 'opened', exitCode: result.exitCode };
  }
}
