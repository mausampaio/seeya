/**
 * `Autostart` for Linux (docs/PLANO-DE-ENTREGA.md S5-T1): a `systemd --user` unit at
 * `~/.config/systemd/user/seeya-daemon.service`, enabled for the default user target. **Not
 * measured** (docs/QUESTOES.md Q-067: only Windows was measured for this task) — this follows the
 * `systemd --user` mechanism the plan names, exercised in unit tests only with an injected
 * `CommandRunner` and a fake file store (AGENTS.md § "Testes": "nenhum teste toca... o systemd"),
 * never a real `systemctl`.
 *
 * **The registered path lives in a `# seeyaBinaryPath=` marker line inside the unit file**, read
 * back verbatim — same reasoning `windows.ts` documents for using `Description` instead of
 * parsing `ExecStart`: a marker this adapter alone writes is a single string comparison, not
 * parsing a shell-quoted command line back apart.
 */
import fs from 'node:fs';
import path from 'node:path';
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
import type { CommandRunner } from '../notification/backend.js';
import { spawnCommand } from '../notification/backend.js';

const UNIT_NAME = 'seeya-daemon.service';
const PATH_MARKER_PREFIX = '# seeyaBinaryPath=';

/** V2-T13, D-045 item 4: one `Environment=` line per entry — systemd's own native, documented way
 * to set a unit's environment (unlike Windows' Task Scheduler, no `cmd.exe` wrapper needed here). */
function buildEnvironmentLines(env: Readonly<Record<string, string>> | undefined): string[] {
  return env === undefined
    ? []
    : Object.entries(env).map(([key, value]) => `Environment=${key}=${value}`);
}

function buildUnitContent(
  execPath: string,
  binaryPath: string,
  env: Readonly<Record<string, string>> | undefined,
): string {
  return [
    '[Unit]',
    'Description=seeya daemon autostart (docs/PLANO-DE-ENTREGA.md S5-T1)',
    PATH_MARKER_PREFIX + binaryPath,
    '',
    '[Service]',
    ...buildEnvironmentLines(env),
    `ExecStart=${execPath} ${binaryPath} daemon`,
    'Restart=no',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

/** `null` when the unit exists but carries no marker line — a hand-edited or foreign unit under
 * the same name, which this adapter cannot claim as its own registration (D-025: absence of the
 * one thing that would confirm it is never read as a guess that it does). */
function readRegisteredPath(unitContent: string): string | null {
  const line = unitContent.split('\n').find((entry) => entry.startsWith(PATH_MARKER_PREFIX));
  return line === undefined ? null : line.slice(PATH_MARKER_PREFIX.length);
}

function defaultReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function defaultWriteFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function defaultRemoveFile(filePath: string): void {
  fs.rmSync(filePath, { force: true });
}

function commandFailure(action: string, exitCode: number | null, stderr: string): Error {
  return new Error(
    `systemctl --user ${action} exited ${String(exitCode)}, expected 0. stderr: ${stderr || '(empty)'}`,
  );
}

export interface LinuxAutostartOptions {
  readonly homeDir?: string;
  readonly run?: CommandRunner;
  readonly readFile?: (path: string) => string | null;
  readonly writeFile?: (path: string, content: string) => void;
  readonly removeFile?: (path: string) => void;
  readonly pathExists?: (path: string) => boolean;
}

export class LinuxAutostart implements Autostart {
  private readonly unitPath: string;
  private readonly run: CommandRunner;
  private readonly readFile: (path: string) => string | null;
  private readonly writeFile: (path: string, content: string) => void;
  private readonly removeFile: (path: string) => void;
  private readonly pathExists: (path: string) => boolean;

  constructor(options: LinuxAutostartOptions = {}) {
    const homeDir = options.homeDir ?? process.env.HOME ?? '';
    this.unitPath = path.join(homeDir, '.config', 'systemd', 'user', UNIT_NAME);
    this.run = options.run ?? spawnCommand;
    this.readFile = options.readFile ?? defaultReadFile;
    this.writeFile = options.writeFile ?? defaultWriteFile;
    this.removeFile = options.removeFile ?? defaultRemoveFile;
    this.pathExists = options.pathExists ?? fs.existsSync;
  }

  private query(): AutostartRawQuery {
    const content = this.readFile(this.unitPath);
    if (content === null) {
      return { registered: false };
    }
    const registeredPath = readRegisteredPath(content);
    return registeredPath === null ? { registered: false } : { registered: true, registeredPath };
  }

  status(): Promise<AutostartStatus> {
    const query = this.query();
    const pathExists = query.registered ? this.pathExists(query.registeredPath) : false;
    return Promise.resolve(classifyAutostartStatus(query, pathExists));
  }

  async enable(
    binaryPath: string,
    options: AutostartLaunchOptions = {},
  ): Promise<AutostartEnableResult> {
    const query = this.query();
    const decision = decideAutostartEnable(query, binaryPath);
    const execPath = options.execPath ?? process.execPath;
    this.writeFile(this.unitPath, buildUnitContent(execPath, binaryPath, options.env));
    await this.runSystemctl('daemon-reload', ['daemon-reload']);
    await this.runSystemctl(`enable ${UNIT_NAME}`, ['enable', UNIT_NAME]);
    return decision;
  }

  async disable(): Promise<AutostartDisableResult> {
    const query = this.query();
    if (!query.registered) {
      return { kind: 'notRegistered' };
    }
    await this.runSystemctl(`disable ${UNIT_NAME}`, ['disable', UNIT_NAME]);
    this.removeFile(this.unitPath);
    return { kind: 'removed' };
  }

  private async runSystemctl(label: string, args: string[]): Promise<void> {
    const result = await this.run('systemctl', ['--user', ...args]);
    if (result.exitCode !== 0) {
      throw commandFailure(label, result.exitCode, result.stderr);
    }
  }
}
