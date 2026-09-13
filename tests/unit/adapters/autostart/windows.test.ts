/**
 * `WindowsAutostart` (docs/PLANO-DE-ENTREGA.md S5-T1, mechanism measured in docs/QUESTOES.md
 * Q-067). `run` is always a `RecordingCommandRunner` here — a real `powershell.exe` is never
 * spawned by this file (AGENTS.md § "Testes").
 */
import { describe, expect, it } from 'vitest';
import { WindowsAutostart } from '../../../../src/adapters/autostart/windows.js';
import { RecordingCommandRunner } from './_command-runner-fakes.js';

const BINARY_PATH = 'C:\\code\\seeya\\dist\\cli\\index.js';

describe('WindowsAutostart#status', () => {
  it('nothing registered → disabled', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"found":false}', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.status()).resolves.toEqual({ kind: 'disabled' });
  });

  it('registered and the path exists → enabled, carrying the path', async () => {
    const runner = new RecordingCommandRunner([
      {
        exitCode: 0,
        stdout: JSON.stringify({ found: true, registeredPath: BINARY_PATH }),
        stderr: '',
      },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run, pathExists: () => true });

    await expect(autostart.status()).resolves.toEqual({
      kind: 'enabled',
      registeredPath: BINARY_PATH,
    });
  });

  it('registered but the path no longer exists → brokenPath (the 2026-09-13 rename case)', async () => {
    const runner = new RecordingCommandRunner([
      {
        exitCode: 0,
        stdout: JSON.stringify({ found: true, registeredPath: BINARY_PATH }),
        stderr: '',
      },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run, pathExists: () => false });

    await expect(autostart.status()).resolves.toEqual({
      kind: 'brokenPath',
      registeredPath: BINARY_PATH,
    });
  });

  it('a non-zero exit code from the query → unknown, with the raw stderr (D-025, never guessed on/off)', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'Access is denied.' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    const status = await autostart.status();
    expect(status.kind).toBe('unknown');
    expect(status.kind === 'unknown' && status.error).toContain('Access is denied.');
  });

  it('stdout failing the zod schema → unknown, not a thrown exception reaching the caller', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"unexpected":"shape"}', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.status()).resolves.toMatchObject({ kind: 'unknown' });
  });
});

describe('WindowsAutostart#enable', () => {
  it('nothing registered yet → registered, and calls powershell with the register script', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"found":false}', stderr: '' },
      { exitCode: 0, stdout: 'OK', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.enable(BINARY_PATH)).resolves.toEqual({
      kind: 'registered',
      path: BINARY_PATH,
    });
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[1]?.command).toBe('powershell.exe');
  });

  it('already registered at the same path → alreadyRegistered, still re-registers (idempotent)', async () => {
    const runner = new RecordingCommandRunner([
      {
        exitCode: 0,
        stdout: JSON.stringify({ found: true, registeredPath: BINARY_PATH }),
        stderr: '',
      },
      { exitCode: 0, stdout: 'OK', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.enable(BINARY_PATH)).resolves.toEqual({
      kind: 'alreadyRegistered',
      path: BINARY_PATH,
    });
  });

  it('registered at a different (renamed) path → updated, naming both paths', async () => {
    const oldPath = 'C:\\code\\see-you-tomorrow\\dist\\cli\\index.js';
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: JSON.stringify({ found: true, registeredPath: oldPath }), stderr: '' },
      { exitCode: 0, stdout: 'OK', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.enable(BINARY_PATH)).resolves.toEqual({
      kind: 'updated',
      previousPath: oldPath,
      newPath: BINARY_PATH,
    });
  });

  it('the register call failing → throws, with the raw stderr (AGENTS.md § "Mensagens de erro")', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"found":false}', stderr: '' },
      { exitCode: 1, stdout: '', stderr: 'Access is denied.' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.enable(BINARY_PATH)).rejects.toThrow('Access is denied.');
  });
});

describe('WindowsAutostart#disable', () => {
  it('removes an existing task → removed', async () => {
    const runner = new RecordingCommandRunner([{ exitCode: 0, stdout: 'REMOVED', stderr: '' }]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.disable()).resolves.toEqual({ kind: 'removed' });
  });

  it('nothing registered → notRegistered, not an error (D-025)', async () => {
    const runner = new RecordingCommandRunner([{ exitCode: 0, stdout: 'ABSENT', stderr: '' }]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.disable()).resolves.toEqual({ kind: 'notRegistered' });
  });

  it('the removal call failing → throws, with the raw stderr', async () => {
    const runner = new RecordingCommandRunner([{ exitCode: 1, stdout: '', stderr: 'boom' }]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(autostart.disable()).rejects.toThrow('boom');
  });
});
