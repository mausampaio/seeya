/**
 * `WindowsAppInstallation` (V2-T13, D-045 item 2, mechanism measured in docs/QUESTOES.md Q-081).
 * `run` is always a `RecordingCommandRunner` here — a real `powershell.exe` is never spawned by
 * this file (AGENTS.md § "Testes").
 */
import { describe, expect, it } from 'vitest';
import { WindowsAppInstallation } from '@seeya-ai/engine/adapters/installation/windows.js';
import { RecordingCommandRunner } from '../autostart/_command-runner-fakes.js';

describe('WindowsAppInstallation#find', () => {
  it('nothing matching "seeya" → notInstalled', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"found":false}', stderr: '' },
    ]);
    const installation = new WindowsAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toEqual({ kind: 'notInstalled' });
  });

  it('found, with InstallLocation set → installed, carrying the derived .exe path', async () => {
    const runner = new RecordingCommandRunner([
      {
        exitCode: 0,
        stdout: JSON.stringify({
          found: true,
          installLocation: 'C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya',
          uninstallString: '',
        }),
        stderr: '',
      },
    ]);
    const installation = new WindowsAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toEqual({
      kind: 'installed',
      executablePath: 'C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\seeya.exe',
    });
  });

  it('found, InstallLocation empty (the measured case, Q-081) → derives from UninstallString', async () => {
    const runner = new RecordingCommandRunner([
      {
        exitCode: 0,
        stdout: JSON.stringify({
          found: true,
          installLocation: '',
          uninstallString:
            '"C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\Uninstall seeya.exe" /currentuser',
        }),
        stderr: '',
      },
    ]);
    const installation = new WindowsAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toEqual({
      kind: 'installed',
      executablePath: 'C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\seeya.exe',
    });
  });

  it('found, but neither field names a usable directory → unknown, never guessed (D-025)', async () => {
    const runner = new RecordingCommandRunner([
      {
        exitCode: 0,
        stdout: JSON.stringify({ found: true, installLocation: '', uninstallString: '' }),
        stderr: '',
      },
    ]);
    const installation = new WindowsAppInstallation({ run: runner.run });

    const status = await installation.find();
    expect(status.kind).toBe('unknown');
  });

  it('a non-zero exit code from the query → unknown, with the raw stderr', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'Access is denied.' },
    ]);
    const installation = new WindowsAppInstallation({ run: runner.run });

    const status = await installation.find();
    expect(status.kind).toBe('unknown');
    expect(status.kind === 'unknown' && status.error).toContain('Access is denied.');
  });

  it('stdout failing the zod schema → unknown, not a thrown exception reaching the caller', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"unexpected":"shape"}', stderr: '' },
    ]);
    const installation = new WindowsAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toMatchObject({ kind: 'unknown' });
  });

  it('the powershell command itself never spawning (ENOENT) → unknown, never thrown', async () => {
    const installation = new WindowsAppInstallation({
      run: () => Promise.reject(new Error('spawn powershell.exe ENOENT')),
    });

    await expect(installation.find()).resolves.toMatchObject({ kind: 'unknown' });
  });
});
