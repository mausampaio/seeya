; V2-T10 item 4: cleans up the `seeya://` registry entry `electron/main.ts#registerProtocolHandler`
; writes at RUNTIME (`app.setAsDefaultProtocolClient`), which the installer itself never wrote in
; the first place — measured, not assumed: `node_modules/app-builder-lib/out/targets/nsis/
; NsisTarget.js` has no protocol-registration handling at all, unlike the mac/linux targets (this
; project's own `electron-builder.yml`'s `protocols:` blocks under `mac`/`linux`, which DO reach
; `LinuxTargetHelper.js`/`electronMac.js`). Without this snippet, `HKCU\Software\Classes\seeya`
; survives an uninstall untouched — the toast's own item 3 (`windows-toast.ts`'s own `Test-Path`
; check) papers over the consequence by never offering a click to a scheme nothing owns any more,
; but the registry key itself stays until something deletes it. This is that something.
;
; `electron-builder` auto-discovers this file at `build/installer.nsh` (relative to
; `packages/app/`, this project's own `directories.buildResources` default) — `nsis.include`'s own
; documented default (`app-builder-lib/out/targets/nsis/nsisOptions.d.ts`), no separate wiring in
; `electron-builder.yml` needed.
;
; Only `seeya` — never `seeya-dev` (V2-T10 item 1's own "o que entra": a dev checkout is never
; installed by this NSIS installer, so nothing packaged ever registers `seeya-dev`, and there is
; nothing here for this macro to remove).

; -----------------------------------------------------------------------------------------------
; V2-T15 item 1: stop the seeya daemon before an install/upgrade and before an uninstall, and
; restart it after an install ONLY if it was running before (never on a fresh install, never after
; an uninstall) — no dialog (docs/PLANO-DE-ENTREGA.md V2-T15's own "sem pergunta na tela").
;
; **Measured before choosing this mechanism.** electron-builder's own NSIS template already ships
; a generic "is the app running" guard (`CHECK_APP_RUNNING`,
; `app-builder-lib/templates/nsis/installer.nsi` -> `installSection.nsh` for install,
; `uninstaller.nsh` for uninstall) that scans for `${APP_EXECUTABLE_FILENAME}` by image name
; (PowerShell `Win32_Process` when available, `tasklist`/`findstr` otherwise) and kills it —
; silently when `${isUpdated}` (an "is this an upgrade over the SAME install mode" flag the
; template computes for its own purposes, not "was OUR daemon running"), with an MB_OKCANCEL
; messagebox otherwise. That messagebox is exactly the confusing prompt the maintainer hit
; installing over a version whose daemon was still running with no window open — the box says the
; app is running, not that it is a background daemon, because the template has no idea a daemon
; exists at all. There is no bundled process-kill PLUGIN this could use instead either:
; `app-builder-lib/templates/nsis/include/nsProcess.nsh` (a macro wrapper for the third-party
; `nsProcess` plugin) ships in the template tree, but no `nsProcess.dll` binary ships anywhere in
; `node_modules`, and nothing electron-builder itself generates ever `!include`s that file — it is
; unused dead weight in the template, not a working option here without a new, unbundled plugin.
;
; Rather than fight the generic guard's own prompt logic (which this file cannot reconfigure —
; `customInit`/`customInstall`/`customUnInstall` are the only hooks available, `docs/
; PLANO-DE-ENTREGA.md V2-T15`'s own words), this stops the daemon BY NAME in `customInit`, which
; runs in `.onInit` — before `Section "install"` ever reaches its own `CHECK_APP_RUNNING` call. By
; the time that generic guard scans, the daemon is already gone; it only has a real, visibly open
; window left to ask about, which is a different, legitimate case this task does not touch.
;
; **Stop/start go through the packaged CLI, not a hand-rolled NSIS process kill.** `daemon --stop`
; is `@seeya-ai/engine/scheduler/daemon-control.ts#runDaemonStop` — already tested, and the one
; piece of logic that knows how to tell a live lock from a stale one and confirm death before
; clearing it (D-025). `daemon` (no flag) is `runDaemonLauncher`'s own spawn — the same one
; `AppContext.startDaemon`/`seeya daemon` already use. Both are reached exactly the way
; `packages/app/src/composition/index.ts#daemonLaunchTarget` reaches them at runtime: the packaged
; `${APP_EXECUTABLE_FILENAME}` itself, with `ELECTRON_RUN_AS_NODE=1` in its environment, pointed at
; `@seeya-ai/cli`'s own compiled entry point INSIDE `app.asar` — never unpacked, and never needs to
; be: `electron-builder.yml`'s own comment on `asarUnpack` already measured this exact invocation
; (`seeya.exe` + that env var + a script path inside the archive) reading correctly from inside it.
;
; **"Estava de pé" comes from `daemon.lock`'s mere existence, checked once in `customInit`, not a
; second liveness check.** Reusing "is it CURRENTLY alive" here would mean parsing `daemon --stop`'s
; own text output back out of `nsExec` — including in the uninstaller context, where the bundled
; `StrContains.nsh` helper (used elsewhere in the assisted-installer template) is only ever
; `!include`d for the INSTALLER half, never the uninstaller, so a second, hand-rolled parser would
; be needed just for this. It buys nothing a stale lock's own recorded state doesn't already cover
; safely: `runDaemonLauncher` refuses with "already running" if the stop somehow did not actually
; finish, so a spurious restart attempt against a daemon that is still alive is a safe no-op, never
; a second daemon (D-005's own single-instance lock already guarantees that).
;
; The uninstaller never restarts anything ("o desinstalador não religa nada", V2-T15's own text) —
; `customUnInstall` only stops.
; -----------------------------------------------------------------------------------------------

Var SeeyaDaemonLockPath
Var SeeyaCliScriptPath
; Measured (a real `npm run dist:windows` run, V2-T15): NSIS's own compiler treats "unreferenced
; variable" as a fatal warning (`warning 6001 ... wasting memory!`, `electron-builder`'s own
; `makensis` wrapper turns any compiler warning into a hard build failure). `$SeeyaDaemonWasRunning`
; is read/written only by `customInit`/`customInstall` — the INSTALLER half — never by
; `customUnInstall`, so declaring it unconditionally broke the UNINSTALLER compile pass
; (`BUILD_UNINSTALLER` defined), which never references it. `installer.nsi`'s own top-level `Var
; appExe`/`Var launchLink` (installer-only state) use the exact same `!ifndef BUILD_UNINSTALLER`
; guard for the same reason.
!ifndef BUILD_UNINSTALLER
  Var SeeyaDaemonWasRunning
  ; V2-T22: `customInstall`'s own restart call's return code (nsExec::ExecToLog's own stack value,
  ; below) — same `!ifndef BUILD_UNINSTALLER` guard as `$SeeyaDaemonWasRunning`, for the identical
  ; reason: only `customInstall` (installer-only) ever writes it.
  Var SeeyaDaemonRestartExitCode
!endif

; Sets/clears ELECTRON_RUN_AS_NODE in the INSTALLER'S OWN process environment (System.dll — a
; stock NSIS plugin, already used throughout these templates for e.g. process enumeration, never a
; new dependency) — `ExecWait` calls issued afterward inherit it, the same mechanism
; `adapters/process/daemon-launch.ts#spawnDetachedDaemon` uses from Node, just from NSIS instead.
; Cleared right after each use (never left set): `assistedInstaller.nsh`'s own `StartApp` function
; launches the freshly installed app at the end of a non-silent install if the person opts in, and
; that launch MUST run as the normal Electron GUI, not as plain Node.
!macro seeyaSetRunAsNode
  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "1")'
!macroend

!macro seeyaClearRunAsNode
  ; `i 0` passes a NULL value pointer, which Win32's own SetEnvironmentVariable documents as
  ; "deletes the variable from the environment" — not the literal string "0".
  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", i 0)'
!macroend

; Recomputed in every hook, never cached across them: `$INSTDIR` can change between `customInit`
; (still the OLD install location, if any — `initMultiUser` resolves it before `customInit` runs)
; and `customInstall` (the FINAL location, which `allowToChangeInstallationDirectory: true` lets
; the person change on the "choose install location" page in between). `$SeeyaDaemonLockPath`
; never depends on `$INSTDIR` at all (`~/.seeya/daemon.lock` is home-based, not install-based) —
; recomputed anyway so this macro has no hidden ordering requirement on its callers.
!macro seeyaResolvePaths
  StrCpy $SeeyaDaemonLockPath "$PROFILE\.seeya\daemon.lock"
  StrCpy $SeeyaCliScriptPath "$INSTDIR\resources\app.asar\node_modules\@seeya-ai\cli\dist\index.js"
!macroend

!macro customInit
  !insertmacro seeyaResolvePaths
  StrCpy $SeeyaDaemonWasRunning "0"
  IfFileExists "$SeeyaDaemonLockPath" 0 seeyaInitNoLock
    StrCpy $SeeyaDaemonWasRunning "1"
  seeyaInitNoLock:
  ; A first-time install has no OLD `${APP_EXECUTABLE_FILENAME}` on disk yet to call — nothing to
  ; stop (and `$SeeyaDaemonWasRunning` would only be "1" here from a daemon this same NSIS-driven
  ; app itself started, which needs an install to have already happened once).
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 seeyaInitDone
    DetailPrint "Stopping the seeya daemon before installing..."
    !insertmacro seeyaSetRunAsNode
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$SeeyaCliScriptPath" daemon --stop'
    !insertmacro seeyaClearRunAsNode
  seeyaInitDone:
!macroend

; V2-T22: the defect this task fixes, measured on the maintainer's machine — this restart used to
; fail SILENTLY. `runDaemonLauncher` refused it (D-045 item 3's ownership check didn't yet know the
; app's own binary is calling itself), and `ExecWait` alone would have thrown that refusal's own
; text away: it only ever returns an exit code, never the child's stdout, and nothing here looked
; at the code either. Two independent fixes to that silence, not one:
;
; 1. **`nsExec::ExecToLog` instead of plain `ExecWait`.** Same bundled plugin
;    `allowOnlyOneInstallerInstance.nsh` already calls elsewhere in this template tree (no new
;    dependency) — it runs the command exactly like `ExecWait` but also pipes every line the child
;    prints to stdout/stderr straight into the installer's own DetailPrint log, so the CLI's own
;    message ("seeya daemon started (pid ...)", or the refusal text this task's own `daemon-
;    command.ts` fix addresses) is what a person reading `%TEMP%\seeya-installer.log` (or the
;    on-screen details view) actually sees, not silence.
; 2. **The exit code, captured and checked too**, as a defensive belt: `runDaemonLauncher`'s own
;    "launcher" branch (`cli/index.ts`) does not currently set a non-zero `process.exitCode` on
;    refusal (only the worker path does) — measured while writing this fix, not assumed — so this
;    check alone would NOT have caught the original defect. It stays because a future failure mode
;    that DOES exit non-zero (a spawn failure inside `spawnDetachedDaemon`, for one) will now also
;    get its own explicit line, instead of counting on someone reading the log line above closely.
!macro customInstall
  ${if} $SeeyaDaemonWasRunning == "1"
    DetailPrint "Restarting the seeya daemon (it was running before this install)..."
    !insertmacro seeyaResolvePaths
    !insertmacro seeyaSetRunAsNode
    nsExec::ExecToLog '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$SeeyaCliScriptPath" daemon'
    Pop $SeeyaDaemonRestartExitCode
    !insertmacro seeyaClearRunAsNode
    ${if} $SeeyaDaemonRestartExitCode != 0
      DetailPrint "Restarting the seeya daemon failed (exit code $SeeyaDaemonRestartExitCode) -- open seeya and use Start daemon, or run 'seeya daemon' yourself."
    ${endIf}
  ${endIf}
!macroend

!macro customUnInstall
  !insertmacro seeyaResolvePaths
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 seeyaUnInstallNoExe
    DetailPrint "Stopping the seeya daemon..."
    !insertmacro seeyaSetRunAsNode
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$SeeyaCliScriptPath" daemon --stop'
    !insertmacro seeyaClearRunAsNode
  seeyaUnInstallNoExe:
  DeleteRegKey HKCU "Software\Classes\seeya"
!macroend
