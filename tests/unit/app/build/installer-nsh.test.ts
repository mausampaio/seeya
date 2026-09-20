/**
 * V2-T15 item 1's own regression guard. `packages/app/build/installer.nsh` is plain NSIS script —
 * this repo has no NSIS compiler/runtime wired into `npm test` (no existing precedent does either;
 * V2-T10 item 4's own `customUnInstall` macro shipped without one), so this cannot prove the
 * generated installer actually stops/restarts a real daemon. What it CAN prove, cheaply and on
 * every OS this suite runs on: the macros this task added are still present, still wired to the
 * packaged CLI the same way, and the "sem pergunta na tela" requirement (no MessageBox) still
 * holds — so a future edit that quietly drops one of these does not go unnoticed until someone
 * hits the exact bug this task fixed (docs/PLANO-DE-ENTREGA.md V2-T15's own achados).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const installerNshPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/app/build/installer.nsh',
);
const installerNsh = readFileSync(installerNshPath, 'utf8');

describe('packages/app/build/installer.nsh', () => {
  it('stops the daemon before install, in customInit', () => {
    const customInitMatch = installerNsh.match(/!macro customInit([\s\S]*?)!macroend/);
    expect(customInitMatch).not.toBeNull();
    const body = customInitMatch?.[1] ?? '';
    expect(body).toContain('daemon --stop');
    expect(body).toContain('SeeyaDaemonWasRunning');
    expect(body).toContain('SeeyaDaemonLockPath');
    expect(installerNsh).toContain('daemon.lock');
  });

  it('restarts the daemon after install only when it was running before, in customInstall', () => {
    const customInstallMatch = installerNsh.match(/!macro customInstall([\s\S]*?)!macroend/);
    expect(customInstallMatch).not.toBeNull();
    const body = customInstallMatch?.[1] ?? '';
    expect(body).toContain('SeeyaDaemonWasRunning');
    // The launcher call — "daemon" with no flag — never a stop.
    expect(body).toContain("daemon'");
    expect(body).not.toContain('--stop');
  });

  it('stops the daemon on uninstall and never restarts it there', () => {
    const customUnInstallMatch = installerNsh.match(/!macro customUnInstall([\s\S]*?)!macroend/);
    expect(customUnInstallMatch).not.toBeNull();
    const body = customUnInstallMatch?.[1] ?? '';
    expect(body).toContain('daemon --stop');
    // Regression proof for V2-T10 item 4 — still removes the protocol registry key.
    expect(body).toContain('DeleteRegKey HKCU "Software\\Classes\\seeya"');
  });

  it('runs the packaged CLI as plain Node, and always clears the env var it sets', () => {
    const setCount = (installerNsh.match(/seeyaSetRunAsNode/g) ?? []).length;
    const clearCount = (installerNsh.match(/seeyaClearRunAsNode/g) ?? []).length;
    // Each macro DEFINES itself once and is INSERTED once per call site — set/clear must pair up.
    expect(setCount).toBe(clearCount);
    expect(installerNsh).toContain('ELECTRON_RUN_AS_NODE');
    expect(installerNsh).toContain('@seeya-ai\\cli\\dist\\index.js');
  });

  // The PO's own design decision (docs/PLANO-DE-ENTREGA.md V2-T15): no dialog for this. The
  // built-in CHECK_APP_RUNNING guard (a different, pre-existing mechanism this task does not
  // touch) still ships its own MessageBox elsewhere in the generated installer — this only proves
  // THIS FILE never adds a second one of its own.
  it('never shows a MessageBox of its own', () => {
    expect(installerNsh).not.toContain('MessageBox');
  });
});
