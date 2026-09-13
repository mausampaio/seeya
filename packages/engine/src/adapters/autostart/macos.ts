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
  AutostartStatus,
} from '../../core/ports.js';
import {
  classifyAutostartStatus,
  decideAutostartEnable,
  type AutostartRawQuery,
} from '../../core/autostart.js';
import type { CommandRunner } from '../notification/backend.js';
import { spawnCommand } from '../notification/backend.js';

const LABEL = 'com.seeya.daemon';
const PLIST_NAME = `${LABEL}.plist`;
const MARKER_PREFIX = '<!-- seeyaBinaryPath:';
const MARKER_SUFFIX = ' -->';

function buildPlistContent(execPath: string, binaryPath: string): string {
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
  readonly run?: CommandRunner;
  readonly readFile?: (path: string) => string | null;
  readonly writeFile?: (path: string, content: string) => void;
  readonly removeFile?: (path: string) => void;
  readonly pathExists?: (path: string) => boolean;
}

export class MacosAutostart implements Autostart {
  private readonly plistPath: string;
  private readonly run: CommandRunner;
  private readonly readFile: (path: string) => string | null;
  private readonly writeFile: (path: string, content: string) => void;
  private readonly removeFile: (path: string) => void;
  private readonly pathExists: (path: string) => boolean;

  constructor(options: MacosAutostartOptions = {}) {
    const homeDir = options.homeDir ?? process.env.HOME ?? '';
    this.plistPath = path.join(homeDir, 'Library', 'LaunchAgents', PLIST_NAME);
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

  async enable(binaryPath: string): Promise<AutostartEnableResult> {
    const query = this.query();
    const decision = decideAutostartEnable(query, binaryPath);
    // `launchctl unload` a possibly-already-loaded agent is tolerated failing (nothing loaded
    // yet, on a first `enable`) — only the write + load that follow have to succeed.
    await this.run('launchctl', ['unload', this.plistPath]).catch(() => undefined);
    this.writeFile(this.plistPath, buildPlistContent(process.execPath, binaryPath));
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
