/**
 * `LinuxAutostart` (docs/PLANO-DE-ENTREGA.md S5-T1). **Not measured against a real system**
 * (docs/QUESTOES.md Q-067: only Windows was measured for this task) — every file/process
 * operation here is faked, per AGENTS.md § "Testes": "nenhum teste toca... o systemd".
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LinuxAutostart } from '@seeya-ai/engine/adapters/autostart/linux.js';
import { RecordingCommandRunner } from './_command-runner-fakes.js';

const HOME_DIR = '/home/<usuario>';
const BINARY_PATH = '/home/<usuario>/code/seeya/dist/cli/index.js';
// Built with `path.join`, same as `LinuxAutostart` itself — never a hardcoded `/`-joined
// literal, which would only match on a POSIX test runner (this suite also runs inside
// `npm run verificar:linux`'s container, but is authored to be host-independent regardless).
const UNIT_PATH = path.join(HOME_DIR, '.config', 'systemd', 'user', 'seeya-daemon.service');

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

describe('LinuxAutostart#status', () => {
  it('no unit file at all → disabled', async () => {
    const { readFile, writeFile, removeFile } = buildFakeFiles();
    const autostart = new LinuxAutostart({ readFile, writeFile, removeFile, homeDir: HOME_DIR });

    await expect(autostart.status()).resolves.toEqual({ kind: 'disabled' });
  });

  it('a unit file with no seeyaBinaryPath marker (hand-edited/foreign) → disabled, not guessed (D-025)', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(UNIT_PATH, '[Unit]\nDescription=other\n');
    const autostart = new LinuxAutostart({ readFile, writeFile, removeFile, homeDir: HOME_DIR });

    await expect(autostart.status()).resolves.toEqual({ kind: 'disabled' });
  });

  it('registered and the path exists → enabled', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(UNIT_PATH, `[Unit]\n# seeyaBinaryPath=${BINARY_PATH}\n`);
    const autostart = new LinuxAutostart({
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
    files.set(UNIT_PATH, `[Unit]\n# seeyaBinaryPath=${BINARY_PATH}\n`);
    const autostart = new LinuxAutostart({
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

describe('LinuxAutostart#enable', () => {
  it('writes the unit file with the marker and calls systemctl --user daemon-reload, then enable', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    ]);
    const autostart = new LinuxAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await expect(autostart.enable(BINARY_PATH)).resolves.toEqual({
      kind: 'registered',
      path: BINARY_PATH,
    });
    expect(files.get(UNIT_PATH)).toContain(`# seeyaBinaryPath=${BINARY_PATH}`);
    expect(runner.calls).toEqual([
      { command: 'systemctl', args: ['--user', 'daemon-reload'] },
      { command: 'systemctl', args: ['--user', 'enable', 'seeya-daemon.service'] },
    ]);
  });

  it('already registered at a different path → updated', async () => {
    const oldPath = '/home/<usuario>/code/see-you-tomorrow/dist/cli/index.js';
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(UNIT_PATH, `# seeyaBinaryPath=${oldPath}\n`);
    const runner = new RecordingCommandRunner();
    const autostart = new LinuxAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await expect(autostart.enable(BINARY_PATH)).resolves.toEqual({
      kind: 'updated',
      previousPath: oldPath,
      newPath: BINARY_PATH,
    });
  });

  it('systemctl failing → throws with the raw stderr', async () => {
    const { readFile, writeFile, removeFile } = buildFakeFiles();
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'unit not found' },
    ]);
    const autostart = new LinuxAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await expect(autostart.enable(BINARY_PATH)).rejects.toThrow('unit not found');
  });
});

describe('LinuxAutostart#disable', () => {
  it('nothing registered → notRegistered, not an error (D-025)', async () => {
    const { readFile, writeFile, removeFile } = buildFakeFiles();
    const autostart = new LinuxAutostart({ readFile, writeFile, removeFile, homeDir: HOME_DIR });

    await expect(autostart.disable()).resolves.toEqual({ kind: 'notRegistered' });
  });

  it('registered → disables via systemctl, removes the unit file, reports removed', async () => {
    const { files, readFile, writeFile, removeFile } = buildFakeFiles();
    files.set(UNIT_PATH, `# seeyaBinaryPath=${BINARY_PATH}\n`);
    const runner = new RecordingCommandRunner([{ exitCode: 0, stdout: '', stderr: '' }]);
    const autostart = new LinuxAutostart({
      readFile,
      writeFile,
      removeFile,
      run: runner.run,
      homeDir: HOME_DIR,
    });

    await expect(autostart.disable()).resolves.toEqual({ kind: 'removed' });
    expect(files.has(UNIT_PATH)).toBe(false);
    expect(runner.calls).toEqual([
      { command: 'systemctl', args: ['--user', 'disable', 'seeya-daemon.service'] },
    ]);
  });
});
