/**
 * `WindowsAutostart` (docs/PLANO-DE-ENTREGA.md S5-T1, mechanism measured in docs/QUESTOES.md
 * Q-067). `run` is always a `RecordingCommandRunner` here — a real `powershell.exe` is never
 * spawned by this file (AGENTS.md § "Testes").
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WindowsAutostart } from '@seeya-ai/engine/adapters/autostart/windows.js';
import { RecordingCommandRunner } from './_command-runner-fakes.js';

const BINARY_PATH = 'C:\\code\\seeya\\dist\\cli\\index.js';
const SEEYA_HOME = 'C:\\Users\\<usuario>\\.seeya';
// Built with `path.join`, same as `WindowsAutostart` itself — same host-independence reasoning
// `linux.test.ts`'s own `UNIT_PATH` already documents (this suite also runs inside `npm run
// verificar:linux`'s container, where `path.join` uses POSIX separators).
const OUTPUT_LOG_PATH = path.join(SEEYA_HOME, 'autostart.log');

/** Decodes `powershell.exe`'s base64-encoded script argument back to text — same helper the
 * "with options.execPath/env" test below already used inline, pulled out since V2-T23 needs it
 * again for the output-capture and env-allowlist tests. */
function decodeScriptArg(args: readonly string[]): string {
  const encoded = args[args.length - 1] ?? '';
  return Buffer.from(encoded, 'base64').toString('utf16le');
}

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

  // V2-T13, D-045 item 4: the app's own composition root passes execPath/env so the registered
  // task points at Electron with ELECTRON_RUN_AS_NODE=1, instead of the implicit process.execPath
  // this adapter always used before this task.
  it('with options.execPath/env: the powershell script carries the cmd.exe env wrapper, not process.execPath', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"found":false}', stderr: '' },
      { exitCode: 0, stdout: 'OK', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run });

    await expect(
      autostart.enable(BINARY_PATH, {
        execPath: 'C:\\seeya\\seeya.exe',
        env: { ELECTRON_RUN_AS_NODE: '1' },
      }),
    ).resolves.toEqual({ kind: 'registered', path: BINARY_PATH });
    // buildPowerShellArgs base64-encodes the script; decode it back to assert on its own content
    // rather than duplicating windows-scripts.test.ts's own assertions on the raw text.
    const decoded = decodeScriptArg(runner.calls[1]?.args ?? []);
    expect(decoded).toContain('cmd.exe');
    expect(decoded).toContain('set ELECTRON_RUN_AS_NODE=1');
    expect(decoded).toContain('C:\\seeya\\seeya.exe');
  });

  // V2-T23 item 5: the registered task always redirects its own stdout/stderr into
  // ~/.seeya/autostart.log — never left out, so a login that fails to start the daemon leaves a
  // trace instead of vanishing silently.
  it('always redirects the launched process output to ~/.seeya/autostart.log', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"found":false}', stderr: '' },
      { exitCode: 0, stdout: 'OK', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run, seeyaHome: SEEYA_HOME });

    await autostart.enable(BINARY_PATH);
    const decoded = decodeScriptArg(runner.calls[1]?.args ?? []);
    expect(decoded).toContain(`>> "${OUTPUT_LOG_PATH}" 2>&1`);
  });

  // V2-T23 items 1/2/4: same measured Mac defect as macos.test.ts's own equivalent case — a
  // caller handing in a live-spawn's WHOLE environment must never see anything but the allowlist
  // land in the registered task.
  it('with a candidate env far beyond the allowlist: only ELECTRON_RUN_AS_NODE/PATH ever reach the powershell script', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: '{"found":false}', stderr: '' },
      { exitCode: 0, stdout: 'OK', stderr: '' },
    ]);
    const autostart = new WindowsAutostart({ run: runner.run, seeyaHome: SEEYA_HOME });

    await autostart.enable(BINARY_PATH, {
      env: {
        ELECTRON_RUN_AS_NODE: '1',
        PATH: 'C:\\Windows\\System32',
        USERPROFILE: 'C:\\Users\\<usuario>',
        USERNAME: '<usuario>',
      },
    });
    const decoded = decodeScriptArg(runner.calls[1]?.args ?? []);
    expect(decoded).toContain('set ELECTRON_RUN_AS_NODE=1');
    expect(decoded).toContain('set PATH=C:\\Windows\\System32');
    expect(decoded).not.toContain('USERPROFILE');
    // `$env:USERNAME` is PowerShell's own template code (present regardless), so this only
    // asserts no `set USERNAME=` was injected by this task's own wrapper.
    expect(decoded).not.toContain('set USERNAME=');
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
