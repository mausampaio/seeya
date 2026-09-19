/**
 * `WindowsToastBackend` (docs/spikes/B-notificacoes.md § Windows). `run` is always a
 * `RecordingCommandRunner` (`_command-runner-fakes.ts`) here — a real `powershell.exe` is never
 * spawned by this file, so this suite is exercisable on any of the three CI systems, and never
 * shows a real toast on whoever runs `npm test` (docs/PLANO-DE-ENTREGA.md S4-T1's own instruction).
 */
import { describe, expect, it } from 'vitest';
import {
  buildPowerShellArgs,
  buildToastScript,
  buildToastXml,
  escapeForPowerShellSingleQuotedString,
  WindowsToastBackend,
} from '@seeya-ai/engine/adapters/notification/windows-toast.js';
import { RecordingCommandRunner } from './_command-runner-fakes.js';

const NOTICE = { title: 'seeya end-day: 2026-08-16', body: '1 session captured.' };

describe('buildToastXml', () => {
  it('embeds the title and body as two ToastGeneric text elements', () => {
    const xml = buildToastXml(NOTICE);
    expect(xml).toContain('<text>seeya end-day: 2026-08-16</text>');
    expect(xml).toContain('<text>1 session captured.</text>');
  });

  it('never emits an <actions> element — this task has no action buttons', () => {
    expect(buildToastXml(NOTICE)).not.toContain('<actions>');
  });

  it('escapes XML-significant characters in both title and body', () => {
    const xml = buildToastXml({ title: 'A & B <script> "quote" \'apos\'', body: 'plain' });
    expect(xml).toContain('A &amp; B &lt;script&gt; &quot;quote&quot; &apos;apos&apos;');
    expect(xml).not.toContain('<script>');
  });

  // V2-T5b item 5.
  it('omits launch/activationType by default (unchanged pre-V2-T5b toast shape)', () => {
    expect(buildToastXml(NOTICE)).toBe(buildToastXml(NOTICE, null));
    expect(buildToastXml(NOTICE)).not.toContain('launch=');
    expect(buildToastXml(NOTICE)).not.toContain('activationType');
  });

  // V2-T10 item 2: scheme replaces the old boolean includeLaunch.
  it('scheme "seeya" adds launch="seeya://open" activationType="protocol" on the <toast> root', () => {
    const xml = buildToastXml(NOTICE, 'seeya');
    expect(xml).toContain('<toast launch="seeya://open" activationType="protocol">');
  });

  it('scheme "seeya-dev" builds the dev scheme URI instead — never the packaged one', () => {
    const xml = buildToastXml(NOTICE, 'seeya-dev');
    expect(xml).toContain('<toast launch="seeya-dev://open" activationType="protocol">');
  });
});

describe('buildToastScript', () => {
  it('loads both WinRT types explicitly before using either', () => {
    const script = buildToastScript(NOTICE);
    expect(script).toContain('Windows.UI.Notifications.ToastNotificationManager');
    expect(script).toContain('Windows.Data.Xml.Dom.XmlDocument');
  });

  it('embeds the exact toast XML for this notice', () => {
    const script = buildToastScript(NOTICE);
    expect(script).toContain(buildToastXml(NOTICE));
  });

  // V2-T10 item 3: no marker at all (scheme === null) — nothing to test, so no Test-Path either.
  it('with no scheme, never emits a Test-Path check at all', () => {
    const script = buildToastScript(NOTICE);
    expect(script).not.toContain('Test-Path');
  });

  // V2-T10 item 3: the script itself confirms the scheme's registry key still exists — no
  // separate process, no JS-side decision baked in ahead of time.
  it('with a scheme, tests HKCU:\\Software\\Classes\\<scheme> before loading the launch XML', () => {
    const script = buildToastScript(NOTICE, 'seeya');
    expect(script).toContain("Test-Path 'HKCU:\\Software\\Classes\\seeya'");
    expect(script).toContain(buildToastXml(NOTICE, 'seeya'));
    expect(script).toContain(buildToastXml(NOTICE, null));
  });

  it('tests the dev scheme key, not the packaged one, when scheme is "seeya-dev"', () => {
    const script = buildToastScript(NOTICE, 'seeya-dev');
    expect(script).toContain("Test-Path 'HKCU:\\Software\\Classes\\seeya-dev'");
    expect(script).not.toContain("Classes\\seeya'");
  });

  it('the conditional falls back to the plain XML in the else branch', () => {
    const script = buildToastScript(NOTICE, 'seeya');
    const elseIndex = script.indexOf('} else {');
    const plainXmlIndex = script.indexOf(
      escapeForPowerShellSingleQuotedString(buildToastXml(NOTICE, null)),
    );
    expect(elseIndex).toBeGreaterThan(-1);
    expect(plainXmlIndex).toBeGreaterThan(elseIndex);
  });
});

describe('escapeForPowerShellSingleQuotedString', () => {
  it('doubles every single quote', () => {
    expect(escapeForPowerShellSingleQuotedString(`it's here`)).toBe(`it''s here`);
  });

  it('leaves a string with no quotes untouched', () => {
    expect(escapeForPowerShellSingleQuotedString('plain text')).toBe('plain text');
  });
});

describe('buildPowerShellArgs', () => {
  it('uses -NoProfile -NonInteractive -NoLogo -EncodedCommand, in that order', () => {
    const args = buildPowerShellArgs('Write-Output hi');
    expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-NoLogo']);
    expect(args[3]).toBe('-EncodedCommand');
  });

  it('the encoded command decodes back to the exact script, UTF-16LE', () => {
    const script = buildToastScript(NOTICE);
    const args = buildPowerShellArgs(script);
    const encoded = args[4] ?? '';
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le');
    expect(decoded).toBe(script);
  });
});

describe('WindowsToastBackend — isAvailable', () => {
  it('is available on win32', async () => {
    const backend = new WindowsToastBackend({ platform: 'win32' });
    await expect(backend.isAvailable()).resolves.toBe(true);
  });

  it('is not available on darwin or linux', async () => {
    await expect(new WindowsToastBackend({ platform: 'darwin' }).isAvailable()).resolves.toBe(
      false,
    );
    await expect(new WindowsToastBackend({ platform: 'linux' }).isAvailable()).resolves.toBe(false);
  });

  it('never claims to support actions', () => {
    expect(new WindowsToastBackend().supportsActions()).toBe(false);
  });
});

describe('WindowsToastBackend — send', () => {
  it('spawns the configured command with the exact toast arguments', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new WindowsToastBackend({ command: 'fake-powershell.exe', run: runner.run });

    await backend.send(NOTICE);

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.command).toBe('fake-powershell.exe');
    expect(runner.calls[0]?.args).toEqual(buildPowerShellArgs(buildToastScript(NOTICE)));
  });

  it('throws when the helper exits non-zero, with the raw stderr in the message', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 1, stdout: '', stderr: 'boom' });
    const backend = new WindowsToastBackend({ run: runner.run });

    await expect(backend.send(NOTICE)).rejects.toThrow(/exited 1.*boom/s);
  });

  // V2-T5b item 5, reshaped by V2-T10 item 2.
  it('with no activeProtocolScheme injected, never includes launch (D-025: no check, no marker)', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new WindowsToastBackend({ run: runner.run });

    await backend.send(NOTICE);

    expect(runner.calls[0]?.args).toEqual(buildPowerShellArgs(buildToastScript(NOTICE, null)));
  });

  it('activeProtocolScheme resolving "seeya" includes launch on the sent toast', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new WindowsToastBackend({
      run: runner.run,
      activeProtocolScheme: () => Promise.resolve('seeya'),
    });

    await backend.send(NOTICE);

    expect(runner.calls[0]?.args).toEqual(buildPowerShellArgs(buildToastScript(NOTICE, 'seeya')));
  });

  it('activeProtocolScheme resolving "seeya-dev" builds the dev scheme toast', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new WindowsToastBackend({
      run: runner.run,
      activeProtocolScheme: () => Promise.resolve('seeya-dev'),
    });

    await backend.send(NOTICE);

    expect(runner.calls[0]?.args).toEqual(
      buildPowerShellArgs(buildToastScript(NOTICE, 'seeya-dev')),
    );
  });

  it('activeProtocolScheme resolving null omits launch', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new WindowsToastBackend({
      run: runner.run,
      activeProtocolScheme: () => Promise.resolve(null),
    });

    await backend.send(NOTICE);

    expect(runner.calls[0]?.args).toEqual(buildPowerShellArgs(buildToastScript(NOTICE, null)));
  });

  it('a throwing activeProtocolScheme reads as null, never derails the send itself', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new WindowsToastBackend({
      run: runner.run,
      activeProtocolScheme: () => Promise.reject(new Error('boom')),
    });

    await backend.send(NOTICE);

    expect(runner.calls[0]?.args).toEqual(buildPowerShellArgs(buildToastScript(NOTICE, null)));
  });
});
