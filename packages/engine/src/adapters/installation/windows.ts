/**
 * `AppInstallation` for Windows (V2-T13, D-045 item 2, mechanism measured in docs/QUESTOES.md
 * Q-081 — see `./windows-installation-scripts.ts`'s own top comment for the full reasoning).
 * `run` defaults to `spawnCommand` (`adapters/notification/backend.ts`), the same
 * `spawnHidden`-backed `CommandRunner` shape `adapters/autostart/windows.ts` already reuses from
 * that same module (AGENTS.md: "nada de duplicação").
 */
import { z } from 'zod';
import type { AppInstallation, AppInstallationStatus } from '../../core/ports.js';
import type { CommandRunner } from '../notification/backend.js';
import { spawnCommand } from '../notification/backend.js';
import { buildPowerShellArgs } from '../notification/windows-toast.js';
import { buildQueryScript, deriveExecutablePath } from './windows-installation-scripts.js';

// AGENTS.md § "Dados de fora": no JSON.parse without a zod schema right after. A single object,
// not a collection — D-022's item-by-item rule is about external COLLECTIONS, which this isn't.
const QueryOutputSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), installLocation: z.string(), uninstallString: z.string() }),
]);

export interface WindowsAppInstallationOptions {
  /** Defaults to `'powershell.exe'`. Overridable so a test points this at a fake executable
   * instead of ever spawning the real one — same seam `adapters/autostart/windows.ts` uses. */
  readonly command?: string;
  readonly run?: CommandRunner;
}

export class WindowsAppInstallation implements AppInstallation {
  private readonly command: string;
  private readonly run: CommandRunner;

  constructor(options: WindowsAppInstallationOptions = {}) {
    this.command = options.command ?? 'powershell.exe';
    this.run = options.run ?? spawnCommand;
  }

  async find(): Promise<AppInstallationStatus> {
    try {
      const result = await this.run(this.command, buildPowerShellArgs(buildQueryScript()));
      if (result.exitCode !== 0) {
        return {
          kind: 'unknown',
          error: `powershell query for the uninstall entry exited ${String(result.exitCode)}, expected 0. stderr: ${result.stderr || '(empty)'}`,
        };
      }
      const parsed = QueryOutputSchema.parse(JSON.parse(result.stdout));
      if (!parsed.found) {
        return { kind: 'notInstalled' };
      }
      const executablePath = deriveExecutablePath(parsed.installLocation, parsed.uninstallString);
      if (executablePath === null) {
        return {
          kind: 'unknown',
          error:
            `the "seeya" uninstall entry was found but neither InstallLocation ` +
            `("${parsed.installLocation}") nor UninstallString ("${parsed.uninstallString}") ` +
            'named a usable install directory',
        };
      }
      return { kind: 'installed', executablePath };
    } catch (error) {
      return { kind: 'unknown', error: error instanceof Error ? error.message : String(error) };
    }
  }
}
