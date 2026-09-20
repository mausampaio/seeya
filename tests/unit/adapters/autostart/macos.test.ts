/**
 * `MacosAutostart` (docs/PLANO-DE-ENTREGA.md S5-T1). **Not measured against a real system**
 * (docs/QUESTOES.md Q-067: only Windows was measured for this task) — every file/process
 * operation here is faked, per AGENTS.md § "Testes": "nenhum teste toca... o launchd".
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MacosAutostart } from '@seeya-ai/engine/adapters/autostart/macos.js';
import { RecordingCommandRunner } from './_command-runner-fakes.js';

const HOME_DIR = '/Users/<usuario>';
const SEEYA_HOME = '/Users/<usuario>/.seeya';
const BINARY_PATH = '/Users/<usuario>/code/seeya/dist/cli/index.js';
// Built with `path.join`, same as `MacosAutostart` itself — host-independent, same reasoning
// as `linux.test.ts`'s own `UNIT_PATH`.
const PLIST_PATH = path.join(HOME_DIR, 'Library', 'LaunchAgents', 'com.seeya.daemon.plist');
const OUTPUT_LOG_PATH = path.join(SEEYA_HOME, 'autostart.log');

function buildFakeFiles(initial: Map<string, string> = new Map()) {
  const files = initial;
  return {
    files,
    readFile: (path: string): string | null => files.get(path) ?? null,
    writeFile: (path: string, content: string): void => {
      files.set(path, content);
    },
    removeFile: (path: string): void => {
      files.delete(path);
    },
  };
}

describe('MacosAutostart#status', () => {
  it('no plist at all → disabled', async () => {
    const { readFile, writeFile, removeFile } = buildFakeFiles();
    const autostart = new MacosAutostart({ readFile, writeFile, removeFile, homeDir: HOME_DIR });

    await expect(autostart.status()).resolves.toEqual({ kind: 'disabled' });
  });

  it('a plist with no seeyaBinaryPath marker (hand-edited/foreign) → disabled, not guessed (D-025)', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(PLIST_PATH, '<plist version="1.0"><dict></dict></plist>');
    const autostart = new MacosAutostart({ readFile, writeFile, removeFile, homeDir: HOME_DIR });

    await expect(autostart.status()).resolves.toEqual({ kind: 'disabled' });
  });

  it('registered and the path exists → enabled', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(PLIST_PATH, `<!-- seeyaBinaryPath:${BINARY_PATH} -->\n<plist></plist>`);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      pathExists: () => true,
      homeDir: HOME_DIR,
    });

    await expect(autostart.status()).resolves.toEqual({
      kind: 'enabled',
      registeredPath: BINARY_PATH,
    });
  });

  it('registered but the path no longer exists → brokenPath', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(PLIST_PATH, `<!-- seeyaBinaryPath:${BINARY_PATH} -->\n<plist></plist>`);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      pathExists: () => false,
      homeDir: HOME_DIR,
    });

    await expect(autostart.status()).resolves.toEqual({
      kind: 'brokenPath',
      registeredPath: BINARY_PATH,
    });
  });
});

describe('MacosAutostart#enable', () => {
  it('writes the plist with the marker, unloads then loads it with launchctl', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'not loaded' },
      { exitCode: 0, stdout: '', stderr: '' },
    ]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
      seeyaHome: SEEYA_HOME,
    });

    await expect(autostart.enable(BINARY_PATH)).resolves.toEqual({
      kind: 'registered',
      path: BINARY_PATH,
    });
    expect(files.get(PLIST_PATH)).toContain(`<!-- seeyaBinaryPath:${BINARY_PATH} -->`);
    expect(runner.calls).toEqual([
      { command: 'launchctl', args: ['unload', PLIST_PATH] },
      { command: 'launchctl', args: ['load', '-w', PLIST_PATH] },
    ]);
  });

  // V2-T23 item 5: launchd's own native StandardOutPath/StandardErrorPath, pointing inside
  // ~/.seeya/ — never left out, so a login that fails to start the daemon leaves a trace.
  it('always writes StandardOutPath/StandardErrorPath, pointing at ~/.seeya/autostart.log', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'not loaded' },
      { exitCode: 0, stdout: '', stderr: '' },
    ]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
      seeyaHome: SEEYA_HOME,
    });

    await autostart.enable(BINARY_PATH);
    const plist = files.get(PLIST_PATH) ?? '';
    expect(plist).toContain('<key>StandardOutPath</key>');
    expect(plist).toContain('<key>StandardErrorPath</key>');
    expect(plist).toContain(`<string>${OUTPUT_LOG_PATH}</string>`);
  });

  // V2-T13, D-045 item 4: the plist's own EnvironmentVariables dict, launchd's native mechanism
  // (no wrapper needed, unlike Windows' Task Scheduler).
  it('with options.env: the plist carries an EnvironmentVariables dict', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'not loaded' },
      { exitCode: 0, stdout: '', stderr: '' },
    ]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
      seeyaHome: SEEYA_HOME,
    });

    await autostart.enable(BINARY_PATH, { env: { ELECTRON_RUN_AS_NODE: '1' } });
    const plist = files.get(PLIST_PATH) ?? '';
    expect(plist).toContain('<key>EnvironmentVariables</key>');
    expect(plist).toContain('<key>ELECTRON_RUN_AS_NODE</key>');
    expect(plist).toContain('<string>1</string>');
  });

  // V2-T23 items 1/2/4: the measured Mac defect — a caller handing in a live-spawn's WHOLE
  // environment must never see anything but the allowlist land in the plist. `SSH_AUTH_SOCK` is
  // the specific variable docs/PLANO-DE-ENTREGA.md V2-T23's own plan entry names as the most
  // dangerous one to keep (a dead socket path makes `git` hang/fail during capture).
  it('with a candidate env far beyond the allowlist: only ELECTRON_RUN_AS_NODE/PATH ever reach the plist', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'not loaded' },
      { exitCode: 0, stdout: '', stderr: '' },
    ]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
      seeyaHome: SEEYA_HOME,
    });

    await autostart.enable(BINARY_PATH, {
      env: {
        ELECTRON_RUN_AS_NODE: '1',
        PATH: '/usr/bin:/bin',
        SSH_AUTH_SOCK: '/private/tmp/com.apple.launchd.deadSocket/Listeners',
        TMPDIR: '/var/folders/dead-login-temp-dir/',
        XPC_SERVICE_NAME: 'com.seeya.app',
        USER: '<usuario>',
        HOME: '/Users/<usuario>',
        SHELL: '/bin/zsh',
      },
    });
    const plist = files.get(PLIST_PATH) ?? '';
    expect(plist).toContain('<key>ELECTRON_RUN_AS_NODE</key>');
    expect(plist).toContain('<key>PATH</key>');
    expect(plist).not.toContain('SSH_AUTH_SOCK');
    expect(plist).not.toContain('TMPDIR');
    expect(plist).not.toContain('XPC_SERVICE_NAME');
    expect(plist).not.toContain('<key>USER</key>');
    expect(plist).not.toContain('<key>HOME</key>');
    expect(plist).not.toContain('<key>SHELL</key>');
  });

  it('without options.env: no EnvironmentVariables key at all — same plist as before this task', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'not loaded' },
      { exitCode: 0, stdout: '', stderr: '' },
    ]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await autostart.enable(BINARY_PATH);
    expect(files.get(PLIST_PATH)).not.toContain('EnvironmentVariables');
  });

  it('load failing → throws with the raw stderr', async () => {
    const { readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'not loaded' },
      { exitCode: 1, stdout: '', stderr: 'permission denied' },
    ]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await expect(autostart.enable(BINARY_PATH)).rejects.toThrow('permission denied');
  });
});

describe('MacosAutostart#disable', () => {
  it('nothing registered → notRegistered, not an error (D-025)', async () => {
    const { readFile, writeFile, removeFile } = buildFakeFiles();
    const autostart = new MacosAutostart({ readFile, writeFile, removeFile, homeDir: HOME_DIR });

    await expect(autostart.disable()).resolves.toEqual({ kind: 'notRegistered' });
  });

  it('registered → unloads via launchctl, removes the plist, reports removed', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(PLIST_PATH, `<!-- seeyaBinaryPath:${BINARY_PATH} -->\n<plist></plist>`);
    const runner = new RecordingCommandRunner([{ exitCode: 0, stdout: '', stderr: '' }]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await expect(autostart.disable()).resolves.toEqual({ kind: 'removed' });
    expect(files.has(PLIST_PATH)).toBe(false);
    expect(runner.calls).toEqual([{ command: 'launchctl', args: ['unload', PLIST_PATH] }]);
  });

  it('unload failing → throws with the raw stderr', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(PLIST_PATH, `<!-- seeyaBinaryPath:${BINARY_PATH} -->\n<plist></plist>`);
    const runner = new RecordingCommandRunner([{ exitCode: 1, stdout: '', stderr: 'boom' }]);
    const autostart = new MacosAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await expect(autostart.disable()).rejects.toThrow('boom');
  });
});
