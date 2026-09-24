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

// Anchored to the start of a line: the bare words "Function SeeyaRestartDaemonAsUser" also appear
// inside this file's own explanatory comments (why the Function exists at all) — an unanchored
// match picks up the FIRST such mention instead of the real `Function ... FunctionEnd` block.
const RESTART_FUNCTION_PATTERN = /^Function SeeyaRestartDaemonAsUser$([\s\S]*?)^FunctionEnd$/m;

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

  // V2-T45 items 2 and 4: the elevated inner instance (a per-machine install re-launched via
  // UAC_RunElevated) must not repeat the original instance's own stop — it just pulls the already-
  // computed state across the elevation boundary instead.
  it('the elevated instance in customInit pulls state from the original one, without stopping again', () => {
    const customInitMatch = installerNsh.match(/!macro customInit([\s\S]*?)!macroend/);
    expect(customInitMatch).not.toBeNull();
    const body = customInitMatch?.[1] ?? '';
    const elevatedBranchMatch = body.match(
      /\$\{if\} \$\{UAC_IsInnerInstance\}([\s\S]*?)\$\{else\}/,
    );
    expect(elevatedBranchMatch).not.toBeNull();
    const elevatedBranch = elevatedBranchMatch?.[1] ?? '';
    expect(elevatedBranch).toContain('UAC_AsUser_GetGlobalVar $SeeyaDaemonWasRunning');
    expect(elevatedBranch).not.toContain('daemon --stop');
  });

  // V2-T45 review round: the actual restart command moved into its own Function
  // (SeeyaRestartDaemonAsUser, called via UAC_AsUser_Call so it runs unprivileged — item 3) —
  // customInstall only wires it up and reads back the exit code.
  it('restarts the daemon after install only when it was running before, via SeeyaRestartDaemonAsUser', () => {
    const customInstallMatch = installerNsh.match(/!macro customInstall([\s\S]*?)!macroend/);
    expect(customInstallMatch).not.toBeNull();
    const customInstallBody = customInstallMatch?.[1] ?? '';
    expect(customInstallBody).toContain('SeeyaDaemonWasRunning');
    expect(customInstallBody).toContain('UAC_AsUser_Call Function SeeyaRestartDaemonAsUser');
    expect(customInstallBody).toContain('Call SeeyaRestartDaemonAsUser');

    const restartFnMatch = installerNsh.match(RESTART_FUNCTION_PATTERN);
    expect(restartFnMatch).not.toBeNull();
    const restartFnBody = restartFnMatch?.[1] ?? '';
    // The launcher call — "daemon" with no flag — never a stop.
    expect(restartFnBody).toContain("daemon'");
    expect(restartFnBody).not.toContain('--stop');
  });

  // V2-T22 regression: the restart used to fail silently (a plain `ExecWait` whose exit code
  // nobody looked at). V2-T45's review round moved the call itself behind `seeyaRunLoggedCli`
  // (nsExec::ExecToStack — see this file's own top comment on why, not ExecToLog any more), inside
  // SeeyaRestartDaemonAsUser; customInstall still reads the exit code back and prints the same
  // failure line when it is non-zero.
  it('the restart call no longer fails silently — logs the CLI output and checks the exit code', () => {
    const restartFnMatch = installerNsh.match(RESTART_FUNCTION_PATTERN);
    expect(restartFnMatch).not.toBeNull();
    const restartFnBody = restartFnMatch?.[1] ?? '';
    expect(restartFnBody).toContain('seeyaRunLoggedCli');
    expect(restartFnBody).not.toContain('ExecWait');
    expect(restartFnBody).not.toContain('nsExec::ExecToLog');
    expect(restartFnBody).toContain('StrCpy $0 $SeeyaLogExitCode');

    const customInstallMatch = installerNsh.match(/!macro customInstall([\s\S]*?)!macroend/);
    expect(customInstallMatch).not.toBeNull();
    const customInstallBody = customInstallMatch?.[1] ?? '';
    expect(customInstallBody).toContain('StrCpy $SeeyaDaemonRestartExitCode $0');
    expect(customInstallBody).toContain('$SeeyaDaemonRestartExitCode != 0');
    expect(customInstallBody).toContain('Restarting the seeya daemon failed');
  });

  // V2-T45 review round, item 3/5: the restart only crosses the elevation boundary
  // (UAC_AsUser_Call) when there actually is a separate, unprivileged ORIGINAL process to reach —
  // i.e. only in the elevated inner instance. Otherwise (per-user install, or per-machine already
  // run as admin from the start) it calls the Function directly, in whichever single process is
  // running — never relying on undocumented plugin fallback behavior.
  it('only crosses the elevation boundary for the restart when actually elevated', () => {
    const customInstallMatch = installerNsh.match(/!macro customInstall([\s\S]*?)!macroend/);
    expect(customInstallMatch).not.toBeNull();
    const body = customInstallMatch?.[1] ?? '';
    expect(body).toContain('${if} ${UAC_IsInnerInstance}');
    expect(body).toContain('${else}');
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

  // V2-T20 item 1: "seeya" on PATH after installing.
  describe('the seeya CLI shim and PATH entry', () => {
    it('writes the shim and adds it to PATH in customInstall', () => {
      const customInstallMatch = installerNsh.match(/!macro customInstall([\s\S]*?)!macroend/);
      expect(customInstallMatch).not.toBeNull();
      const body = customInstallMatch?.[1] ?? '';
      expect(body).toContain('seeyaWriteCliShim');
      expect(body).toContain('seeyaAddBinDirToUserPath');
    });

    it('removes the shim and the PATH entry in customUnInstall, unconditionally', () => {
      const customUnInstallMatch = installerNsh.match(/!macro customUnInstall([\s\S]*?)!macroend/);
      expect(customUnInstallMatch).not.toBeNull();
      const body = customUnInstallMatch?.[1] ?? '';
      expect(body).toContain('seeyaRemoveCliShim');
      expect(body).toContain('seeyaRemoveBinDirFromUserPath');
    });

    it('writes the shim into its own bin subdirectory, never the GUI exe directory', () => {
      const shimMacroMatch = installerNsh.match(/!macro seeyaWriteCliShim([\s\S]*?)!macroend/);
      expect(shimMacroMatch).not.toBeNull();
      const body = shimMacroMatch?.[1] ?? '';
      expect(body).toContain('$SeeyaBinDirPath\\seeya.cmd');
      expect(body).toContain('ELECTRON_RUN_AS_NODE=1');
      // %~dp0-relative, never a baked-in $INSTDIR — see the macro's own comment for why.
      expect(body).toContain('%~dp0..\\${APP_EXECUTABLE_FILENAME}');
      expect(body).toContain(
        '%~dp0..\\resources\\app.asar\\node_modules\\@seeya-ai\\cli\\dist\\index.js',
      );
    });

    it('never reuses StrContains.nsh (already !include-d by the default assisted-installer template)', () => {
      // The name itself is still allowed in explanatory comments (why it's not reused) — only an
      // actual !include, which would double-define its Function and fail the compile, is checked.
      expect(installerNsh).not.toContain('!include StrContains');
      expect(installerNsh).not.toContain('!include "StrContains');
    });

    it('defines a separate un.-prefixed find function for the uninstaller half', () => {
      expect(installerNsh).toContain('Function SeeyaPathFind');
      expect(installerNsh).toContain('Function un.SeeyaPathFind');
      expect(installerNsh).toContain('Call SeeyaPathFind');
      expect(installerNsh).toContain('Call un.SeeyaPathFind');
    });
  });

  // V2-T20 item 2: uninstalling removes the autostart registration too.
  it('removes autostart in customUnInstall, best-effort, via the packaged CLI', () => {
    const customUnInstallMatch = installerNsh.match(/!macro customUnInstall([\s\S]*?)!macroend/);
    expect(customUnInstallMatch).not.toBeNull();
    const body = customUnInstallMatch?.[1] ?? '';
    expect(body).toContain('seeyaDisableAutostart');
    const disableMacroMatch = installerNsh.match(/!macro seeyaDisableAutostart([\s\S]*?)!macroend/);
    expect(disableMacroMatch).not.toBeNull();
    const disableBody = disableMacroMatch?.[1] ?? '';
    expect(disableBody).toContain('autostart disable');
    // V2-T45 review round: seeyaRunLoggedCli (nsExec::ExecToStack), not the plain ExecToLog this
    // macro used before — see this file's own top comment on why.
    expect(disableBody).toContain('seeyaRunLoggedCli');
    expect(disableBody).not.toContain('nsExec::ExecToLog');
    // Best-effort like the restart in customInstall: logs a failure, never aborts (no `Abort`).
    expect(disableBody).not.toContain('Abort');
  });

  // V2-T45 item 1: an update is not an uninstall — the old uninstaller electron-builder's own
  // uninstallOldVersion runs on top of a fresh install must not turn autostart off or delete the
  // protocol key, since the new version's own customInstall is about to set the final state anyway.
  // Stopping the daemon still always runs (files need to be replaceable either way).
  describe('customUnInstall does not undo autostart/protocol state during an update', () => {
    const customUnInstallMatch = installerNsh.match(/!macro customUnInstall([\s\S]*?)!macroend/);
    const body = customUnInstallMatch?.[1] ?? '';

    it('gates seeyaDisableAutostart on NOT ${isUpdated}', () => {
      expect(customUnInstallMatch).not.toBeNull();
      const gatedCallMatch = body.match(
        /\$\{ifNot\} \$\{isUpdated\}([\s\S]*?)(\$\{else\}|\$\{endIf\})/,
      );
      expect(gatedCallMatch).not.toBeNull();
      expect(gatedCallMatch?.[1] ?? '').toContain('seeyaDisableAutostart');
    });

    it('gates DeleteRegKey on NOT ${isUpdated}', () => {
      expect(customUnInstallMatch).not.toBeNull();
      const lastGate = [...body.matchAll(/\$\{ifNot\} \$\{isUpdated\}([\s\S]*?)\$\{endIf\}/g)].at(
        -1,
      );
      expect(lastGate).toBeDefined();
      expect(lastGate?.[1] ?? '').toContain('DeleteRegKey HKCU "Software\\Classes\\seeya"');
    });

    it('still always stops the daemon, update or not', () => {
      expect(customUnInstallMatch).not.toBeNull();
      // The daemon --stop call sits BEFORE either ${isUpdated} gate — outside both.
      const stopIndex = body.indexOf('daemon --stop');
      const firstGateIndex = body.indexOf('${ifNot} ${isUpdated}');
      expect(stopIndex).toBeGreaterThan(-1);
      expect(firstGateIndex).toBeGreaterThan(-1);
      expect(stopIndex).toBeLessThan(firstGateIndex);
    });
  });

  // V2-T45 item 5: the log has a size cap, checked on every write, so it never grows unbounded
  // across however many updates a machine goes through.
  it('caps installer.log at a fixed size and checks it on every write', () => {
    expect(installerNsh).toContain('SEEYA_INSTALLER_LOG_MAX_BYTES');
    const logWriteMatch = installerNsh.match(/!macro seeyaLogWrite([\s\S]*?)!macroend/);
    expect(logWriteMatch).not.toBeNull();
    const body = logWriteMatch?.[1] ?? '';
    expect(body).toContain('SEEYA_INSTALLER_LOG_MAX_BYTES');
    // Never overwrites the whole file on a normal write — only when over the cap.
    expect(body).toContain('FileOpen $SeeyaLogFileHandle "$SeeyaLogPath" a');
    expect(body).toContain('FileOpen $SeeyaLogFileHandle "$SeeyaLogPath" w');
  });

  // V2-T45 review round, item 1 (bug fix): `${APP_EXECUTABLE_FILENAME}` is a compile-time define —
  // passing it as part of a STRING ARGUMENT to another macro (seeyaRunLoggedCli) does not reliably
  // re-expand once substituted into that macro's own body (measured on a real `npm run
  // dist:windows` run: "warning 6000: unknown variable/constant "{APP_EXECUTABLE_FILENAME}"
  // detected, ignoring (macro:seeyaRunLoggedCli:3)", a fatal error under -WX). Every command passed
  // to seeyaRunLoggedCli must use the runtime $SeeyaAppExePath variable instead, never the define.
  it('never passes the ${APP_EXECUTABLE_FILENAME} define through a seeyaRunLoggedCli argument', () => {
    const callLines = installerNsh
      .split('\n')
      .filter((line) => line.includes('!insertmacro seeyaRunLoggedCli'));
    expect(callLines.length).toBeGreaterThan(0);
    for (const line of callLines) {
      expect(line).not.toContain('${APP_EXECUTABLE_FILENAME}');
    }
  });

  // V2-T45 review round: the second, deeper bug the same real build uncovered —
  // `${APP_EXECUTABLE_FILENAME}` does not resolve at all inside `seeyaResolvePaths` itself (a
  // nested macro), even as a plain, un-nested StrCpy operand. Fixed by moving that one StrCpy out
  // to each top-level caller instead (customInit/customInstall/customUnInstall) — this guards
  // against it quietly creeping back into the nested macro's own body.
  it('never resolves ${APP_EXECUTABLE_FILENAME} inside seeyaResolvePaths itself', () => {
    const resolvePathsMatch = installerNsh.match(/!macro seeyaResolvePaths([\s\S]*?)!macroend/);
    expect(resolvePathsMatch).not.toBeNull();
    expect(resolvePathsMatch?.[1] ?? '').not.toContain('APP_EXECUTABLE_FILENAME');
  });

  // V2-T45 review round: LogicLib.nsh/FileFunc.nsh explicitly !include-d at this file's own top —
  // this file is !include-d by electron-builder before installer.nsi's own chain would otherwise
  // provide them, and a macro nested two layers deep (seeyaLogWrite, called from
  // seeyaRunLoggedCli) failed to compile ("Invalid command: ${ifNot}") without this.
  it('explicitly includes LogicLib.nsh and FileFunc.nsh at its own top', () => {
    const firstNonCommentLines = installerNsh
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.trim().startsWith(';'))
      .slice(0, 2);
    expect(firstNonCommentLines).toEqual(['!include "LogicLib.nsh"', '!include "FileFunc.nsh"']);
  });
});
