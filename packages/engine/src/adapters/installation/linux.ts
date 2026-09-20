/**
 * `AppInstallation` for Linux (V2-T13, D-045 item 2): asks `dpkg` whether the `.deb` package this
 * project's own installer publishes (`packages/app/electron-builder.yml`'s `linux.target: deb`) is
 * installed. **Not measured against a real `.deb` install** (docs/QUESTOES.md Q-081: only Windows
 * was measured for this task, same disclaimer `adapters/autostart/linux.ts` already carries for
 * the identical reason) — exercised in unit tests only with an injected `CommandRunner`, never a
 * real `dpkg`.
 *
 * **An `AppImage` run never shows up here, with no special-casing needed.** `dpkg`'s own package
 * database is only ever populated by an actual `.deb` install; an `AppImage` launch never touches
 * it, so `dpkg-query` reporting "not installed" is simply the truth for that case too — D-045's
 * own "AppImage nunca é dono" falls straight out of asking the right question, not a separate
 * check this adapter has to remember to run.
 */
import type { AppInstallation, AppInstallationStatus } from '../../core/ports.js';
import type { CommandRunner } from '../notification/backend.js';
import { spawnCommand } from '../notification/backend.js';

/** The `.deb` package name `electron-builder` derives from `executableName`
 * (`packages/app/electron-builder.yml`) — not independently confirmed against a real build on
 * this OS (see this file's own top comment). */
const PACKAGE_NAME = 'seeya';

/** `electron-builder`'s own conventional Linux install layout for a `deb` target
 * (`executableName: seeya`) — not independently confirmed against a real build on this OS (see
 * this file's own top comment), same "follow the documented convention, not measured" status
 * `adapters/autostart/linux.ts` already carries. */
const EXECUTABLE_PATH = `/usr/bin/${PACKAGE_NAME}`;

/** `dpkg-query`'s own well-known negative-answer shapes (package never known, or removed but not
 * purged) — both read as `notInstalled`, never `unknown`: `dpkg` DID answer, definitively. */
const NOT_INSTALLED_STATUS_PREFIXES = ['unknown ok not-installed', 'deinstall'];

function isNotInstalledStatus(status: string): boolean {
  const trimmed = status.trim().toLowerCase();
  return NOT_INSTALLED_STATUS_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export interface LinuxAppInstallationOptions {
  readonly run?: CommandRunner;
}

export class LinuxAppInstallation implements AppInstallation {
  private readonly run: CommandRunner;

  constructor(options: LinuxAppInstallationOptions = {}) {
    this.run = options.run ?? spawnCommand;
  }

  async find(): Promise<AppInstallationStatus> {
    try {
      const result = await this.run('dpkg-query', [
        '-W',
        '-f=${Status}\n${Version}\n',
        PACKAGE_NAME,
      ]);
      return this.classify(result.exitCode, result.stdout, result.stderr);
    } catch (error) {
      // `dpkg-query` itself missing (a non-Debian distro) or unspawnable — genuinely unknown,
      // never guessed as "not installed" (D-025): this project's own installer only ever targets
      // `.deb`, but a machine without `dpkg` at all could still be running a manually-placed
      // build this adapter has no way to see either way.
      return { kind: 'unknown', error: error instanceof Error ? error.message : String(error) };
    }
  }

  private classify(exitCode: number | null, stdout: string, stderr: string): AppInstallationStatus {
    if (exitCode !== 0) {
      // dpkg-query's own documented negative answer for "no such package known at all" — the
      // ordinary "not installed" case, not a failure of the query itself.
      if (/no packages found matching/i.test(stderr)) {
        return { kind: 'notInstalled' };
      }
      return {
        kind: 'unknown',
        error: `dpkg-query exited ${String(exitCode)}, expected 0. stderr: ${stderr || '(empty)'}`,
      };
    }
    const [status] = stdout.split('\n');
    if (status === undefined || isNotInstalledStatus(status)) {
      return { kind: 'notInstalled' };
    }
    if (!status.trim().toLowerCase().startsWith('install ok installed')) {
      // A shape `dpkg-query`'s own documented statuses don't cover — reported honestly rather
      // than guessed at either way (D-025).
      return { kind: 'unknown', error: `dpkg-query reported an unrecognized Status: "${status}"` };
    }
    return { kind: 'installed', executablePath: EXECUTABLE_PATH };
  }
}
