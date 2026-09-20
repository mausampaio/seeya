/**
 * `Autostart` for macOS (docs/PLANO-DE-ENTREGA.md S5-T1): a LaunchAgent plist at
 * `~/Library/LaunchAgents/com.seeya.daemon.plist`, loaded with `launchctl`. **Not measured**
 * (docs/QUESTOES.md Q-067: only Windows was measured for this task) — this follows the
 * documented LaunchAgent mechanism the plan names, exercised in unit tests only with an injected
 * `CommandRunner` and a fake file store, never a real `launchctl`.
 *
 * **The registered path lives in a `<!-- seeyaBinaryPath:...-->` marker comment inside the
 * plist**, read back verbatim — same reasoning `linux.ts`/`windows.ts` document for their own
 * marker/`Description` field: a value only this adapter ever writes is a single string search,
 * not a plist parser.
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
import { AUTOSTART_OUTPUT_LOG_FILE_NAME, buildAutostartEnv } from './env.js';
import type { CommandRunner } from '../notification/backend.js';
import { spawnCommand } from '../notification/backend.js';

const LABEL = 'com.seeya.daemon';
const PLIST_NAME = `${LABEL}.plist`;
const MARKER_PREFIX = '<!-- seeyaBinaryPath:';
const MARKER_SUFFIX = ' -->';

/** V2-T13, D-045 item 4: `launchd`'s own native, documented way to set a job's environment (no
 * `sh -c`/`cmd.exe`-style wrapper needed here, unlike Windows' Task Scheduler). Returns no lines
 * at all when `env` is empty/undefined — same plist text as before this task. */
function buildEnvironmentVariablesLines(
  env: Readonly<Record<string, string>> | undefined,
): string[] {
  const entries = env === undefined ? [] : Object.entries(env);
  if (entries.length === 0) {
    return [];
  }
  return [
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    ...entries.flatMap(([key, value]) => [
      `    <key>${key}</key>`,
      `    <string>${value}</string>`,
    ]),
    '  </dict>',
  ];
}

/** V2-T23 item 5: `launchd`'s own native way to capture a launched job's stdout/stderr — no
 * wrapper needed here, unlike Windows' Task Scheduler. Both keys point at the SAME file
 * (`AUTOSTART_OUTPUT_LOG_FILE_NAME`), stdout and stderr interleaved, which is enough to answer "did
 * this run, and what did it say" without a second file to check; launchd creates the file if it
 * doesn't exist and does not truncate it between runs, so the file is a running history across
 * logins, not just the last one. */
function buildOutputCaptureLines(outputLogPath: string): string[] {
  return [
    '  <key>StandardOutPath</key>',
    `  <string>${outputLogPath}</string>`,
    '  <key>StandardErrorPath</key>',
    `  <string>${outputLogPath}</string>`,
  ];
}

function buildPlistContent(
  execPath: string,
  binaryPath: string,
  env: Readonly<Record<string, string>> | undefined,
  outputLogPath: string,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    `${MARKER_PREFIX}${binaryPath}${MARKER_SUFFIX}`,
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  <string>${LABEL}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${execPath}</string>`,
    `    <string>${binaryPath}</string>`,
    '    <string>daemon</string>',
    '  </array>',
    ...buildEnvironmentVariablesLines(env),
    ...buildOutputCaptureLines(outputLogPath),
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

/** `null` when the plist exists but carries no marker — a hand-edited or foreign LaunchAgent
 * under the same label, which this adapter cannot claim as its own registration (D-025). */
function readRegisteredPath(plistContent: string): string | null {
  const start = plistContent.indexOf(MARKER_PREFIX);
  if (start === -1) {
    return null;
  }
  const end = plistContent.indexOf(MARKER_SUFFIX, start);
  return end === -1 ? null : plistContent.slice(start + MARKER_PREFIX.length, end);
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
    `launchctl ${action} exited ${String(exitCode)}, expected 0. stderr: ${stderr || '(empty)'}`,
  );
}

export interface MacosAutostartOptions {
  readonly homeDir?: string;
  /** V2-T23: the injectable `~/.seeya/` root (D-027) — separate from `homeDir` above, which is
   * only ever used for `~/Library/LaunchAgents/`. Defaults to `''` the same way `homeDir` falls
   * back to `process.env.HOME ?? ''`: a real value always comes from `buildAutostart`'s own
   * caller, this is only ever hit by a test that doesn't care about the output log path. */
  readonly seeyaHome?: string;
  readonly run?: CommandRunner;
  readonly readFile?: (path: string) => string | null;
  readonly writeFile?: (path: string, content: string) => void;
  readonly removeFile?: (path: string) => void;
  readonly pathExists?: (path: string) => boolean;
}

export class MacosAutostart implements Autostart {
  private readonly plistPath: string;
  private readonly outputLogPath: string;
  private readonly run: CommandRunner;
  private readonly readFile: (path: string) => string | null;
  private readonly writeFile: (path: string, content: string) => void;
  private readonly removeFile: (path: string) => void;
  private readonly pathExists: (path: string) => boolean;

  constructor(options: MacosAutostartOptions = {}) {
    const homeDir = options.homeDir ?? process.env.HOME ?? '';
    this.plistPath = path.join(homeDir, 'Library', 'LaunchAgents', PLIST_NAME);
    this.outputLogPath = path.join(options.seeyaHome ?? '', AUTOSTART_OUTPUT_LOG_FILE_NAME);
    this.run = options.run ?? spawnCommand;
    this.readFile = options.readFile ?? defaultReadFile;
    this.writeFile = options.writeFile ?? defaultWriteFile;
    this.removeFile = options.removeFile ?? defaultRemoveFile;
    this.pathExists = options.pathExists ?? fs.existsSync;
  }

  private query(): AutostartRawQuery {
    const content = this.readFile(this.plistPath);
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
    // `launchctl unload` a possibly-already-loaded agent is tolerated failing (nothing loaded
    // yet, on a first `enable`) — only the write + load that follow have to succeed.
    await this.run('launchctl', ['unload', this.plistPath]).catch(() => undefined);
    const execPath = options.execPath ?? process.execPath;
    // V2-T23: only the allowlisted vars ever reach the plist — see env.ts's own docstring for why
    // `options.env` (which could be anything a caller hands in) is never trusted verbatim.
    const env = buildAutostartEnv(options.env ?? {});
    this.writeFile(
      this.plistPath,
      buildPlistContent(execPath, binaryPath, env, this.outputLogPath),
    );
    const result = await this.run('launchctl', ['load', '-w', this.plistPath]);
    if (result.exitCode !== 0) {
      throw commandFailure(`load -w ${this.plistPath}`, result.exitCode, result.stderr);
    }
    return decision;
  }

  async disable(): Promise<AutostartDisableResult> {
    const query = this.query();
    if (!query.registered) {
      return { kind: 'notRegistered' };
    }
    const result = await this.run('launchctl', ['unload', this.plistPath]);
    if (result.exitCode !== 0) {
      throw commandFailure(`unload ${this.plistPath}`, result.exitCode, result.stderr);
    }
    this.removeFile(this.plistPath);
    return { kind: 'removed' };
  }
}
