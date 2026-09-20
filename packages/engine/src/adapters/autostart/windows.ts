/**
 * `Autostart` for Windows (docs/PLANO-DE-ENTREGA.md S5-T1, mechanism measured in
 * docs/QUESTOES.md Q-067 — see `./windows-scripts.ts`'s own top comment for the full reasoning).
 * `run` defaults to `spawnCommand` (`adapters/notification/backend.ts`) — the same
 * `spawnHidden`-backed `CommandRunner` shape `WindowsToastBackend` already uses, reused rather
 * than reinvented (AGENTS.md: "nada de duplicação"): both adapters only ever need "run
 * `powershell.exe` with these args, get back exit code + stdout + stderr".
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type {
  Autostart,
  AutostartDisableResult,
  AutostartEnableResult,
  AutostartLaunchOptions,
  AutostartStatus,
} from '../../core/ports.js';
import {
  classifyAutostartStatus,
  decideAutostartEnable,
  type AutostartRawQuery,
} from '../../core/autostart.js';
import { AUTOSTART_OUTPUT_LOG_FILE_NAME, buildAutostartEnv } from './env.js';
import type { CommandRunner } from '../notification/backend.js';
import { spawnCommand } from '../notification/backend.js';
import { buildPowerShellArgs } from '../notification/windows-toast.js';
import { buildQueryScript, buildRegisterScript, buildUnregisterScript } from './windows-scripts.js';

// AGENTS.md § "Dados de fora": no JSON.parse without a zod schema right after. A single object,
// not a collection — D-022's item-by-item rule is about external COLLECTIONS, which this isn't.
const QueryOutputSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), registeredPath: z.string() }),
]);

export interface WindowsAutostartOptions {
  /** Defaults to `'powershell.exe'`. Overridable so a test points this at a fake executable
   * instead of ever spawning the real one — same seam `WindowsToastBackend` already uses. */
  readonly command?: string;
  /** V2-T23: the injectable `~/.seeya/` root (D-027), unlike the other two OS adapters never used
   * for the registration itself (Task Scheduler carries no filesystem root of its own) — only for
   * where the launched process's stdout/stderr land. Defaults to `''`: a real value always comes
   * from `buildAutostart`'s own caller, this is only ever hit by a test that doesn't care about
   * the output log path. */
  readonly seeyaHome?: string;
  readonly run?: CommandRunner;
  readonly pathExists?: (path: string) => boolean;
}

function commandFailure(action: string, exitCode: number | null, stderr: string): Error {
  return new Error(
    `powershell ${action} exited ${String(exitCode)}, expected 0. stderr: ${stderr || '(empty)'}`,
  );
}

export class WindowsAutostart implements Autostart {
  private readonly command: string;
  private readonly outputLogPath: string;
  private readonly run: CommandRunner;
  private readonly pathExists: (path: string) => boolean;

  constructor(options: WindowsAutostartOptions = {}) {
    this.command = options.command ?? 'powershell.exe';
    this.outputLogPath = path.join(options.seeyaHome ?? '', AUTOSTART_OUTPUT_LOG_FILE_NAME);
    this.run = options.run ?? spawnCommand;
    this.pathExists = options.pathExists ?? fs.existsSync;
  }

  private async query(): Promise<AutostartRawQuery> {
    const result = await this.run(this.command, buildPowerShellArgs(buildQueryScript()));
    if (result.exitCode !== 0) {
      throw commandFailure('query for the scheduled task', result.exitCode, result.stderr);
    }
    const parsed = QueryOutputSchema.parse(JSON.parse(result.stdout));
    return parsed.found
      ? { registered: true, registeredPath: parsed.registeredPath }
      : { registered: false };
  }

  async status(): Promise<AutostartStatus> {
    try {
      const query = await this.query();
      const pathExists = query.registered ? this.pathExists(query.registeredPath) : false;
      return classifyAutostartStatus(query, pathExists);
    } catch (error) {
      return { kind: 'unknown', error: error instanceof Error ? error.message : String(error) };
    }
  }

  async enable(
    binaryPath: string,
    options: AutostartLaunchOptions = {},
  ): Promise<AutostartEnableResult> {
    const query = await this.query();
    const decision = decideAutostartEnable(query, binaryPath);
    const execPath = options.execPath ?? process.execPath;
    // V2-T23: only the allowlisted vars ever reach the registered task — see env.ts's own
    // docstring for why `options.env` (which could be anything a caller hands in) is never
    // trusted verbatim.
    const env = buildAutostartEnv(options.env ?? {});
    const script = buildRegisterScript(execPath, binaryPath, this.outputLogPath, env);
    const result = await this.run(this.command, buildPowerShellArgs(script));
    if (result.exitCode !== 0) {
      throw commandFailure('registration of the autostart task', result.exitCode, result.stderr);
    }
    return decision;
  }

  async disable(): Promise<AutostartDisableResult> {
    const result = await this.run(this.command, buildPowerShellArgs(buildUnregisterScript()));
    if (result.exitCode !== 0) {
      throw commandFailure('removal of the autostart task', result.exitCode, result.stderr);
    }
    return result.stdout.trim() === 'REMOVED' ? { kind: 'removed' } : { kind: 'notRegistered' };
  }
}
