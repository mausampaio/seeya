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
; V2-T20 item 1: `$INSTDIR\bin`, the directory this file adds to the current user's own PATH --
; see `seeyaResolvePaths` below for why it is recomputed alongside the other two paths, and the
; "seeya on PATH" section further down for the macros that use it.
Var SeeyaBinDirPath

; -----------------------------------------------------------------------------------------------
; V2-T45 item 5: `~/.seeya/installer.log` -- a real log, in place of the comments below (V2-T15/
; V2-T22) that used to cite `%TEMP%\seeya-installer.log`, a path this file never actually wrote
; to (measured: the maintainer's own machine had no such file after an install, V2-T45's own
; report). One line per step, timestamped, naming which of the three instances a per-machine
; update runs wrote it (`original` / `elevated` / `old-uninstaller`, V2-T45's own vocabulary) --
; this is what lets the acceptance test read where four minutes went, instead of a stopwatch.
;
; **Declared unconditionally (no `!ifndef`/`!ifdef BUILD_UNINSTALLER` guard), unlike
; `$SeeyaDaemonWasRunning`.** `seeyaLogWrite`/`seeyaRunLoggedCli` below are inserted from BOTH
; `customInit`/`customInstall` (installer-only) AND `customUnInstall` (uninstaller-only) call
; sites, so every one of these Vars ends up referenced in both compiler passes -- same reasoning
; `seeyaResolvePaths`'s own Vars already rely on, just for a new set of Vars.
;
; **`${GetTime}` comes from `FileFunc.nsh`, already `!include`d by `multiUser.nsh` (this
; template's own `include/UAC.nsh` chain) before this file's macros are ever inserted** -- checked
; directly in the cached template tree before writing this, not assumed: re-`!include`ing it here
; would risk the exact "already defined" failure `StrContains.nsh` already caused elsewhere in
; this file (see `SeeyaPathFind`'s own comment above).
;
; **`nsExec::ExecToStack`, not `ExecToLog`, for every CLI call this file makes from here on.**
; `ExecToLog` only ever reaches the on-screen details view, which V2-T22's own restart call
; already needed but which item 3 (below) shows is NOT available for the daemon restart once it
; runs across the UAC elevation boundary -- `ExecToStack` is the one mechanism that gets the CLI's
; own text back into OUR hands (on the stack) so it can go into a file instead, from any process.
; Traded off: NSIS's own `${NSIS_MAX_STRLEN}` still caps how much of that text a single
; `ExecToStack` call can capture -- long CLI output is truncated by NSIS itself, not by this file.
;
; **Teto: 256 KiB (${SEEYA_INSTALLER_LOG_MAX_BYTES}).** A handful of timestamped one-line steps
; per install run (well under 1 KiB total) means this covers dozens of updates before ever
; truncating -- enough to compare "how long did this update take" against the last one or two, the
; acceptance test's own use case, without the file growing without bound on a machine that updates
; seeya often. Checked on every write (`seeyaLogWrite`, not a separate "start of install" check):
; simpler than tracking "is this the first write of this run" across three unrelated processes,
; and it still means the cap is only ever crossed at the start of some future run's own first
; line, in practice.
;
; **Never fails the install.** Every `FileOpen`/`FileSeek` is guarded with `${if}${Errors}` and
; `ClearErrors` before returning control -- a log line that could not be written is one line
; short, never an aborted step.
; -----------------------------------------------------------------------------------------------

!define SEEYA_INSTALLER_LOG_MAX_BYTES 262144

Var SeeyaLogPath
Var SeeyaLogSize
Var SeeyaLogFileHandle
Var SeeyaLogExitCode
Var SeeyaLogOutput
Var SeeyaLogTimeDay
Var SeeyaLogTimeMonth
Var SeeyaLogTimeYear
Var SeeyaLogTimeDow
Var SeeyaLogTimeHour
Var SeeyaLogTimeMinute
Var SeeyaLogTimeSecond

; Appends one timestamped, instance-labelled line to `~/.seeya/installer.log`, truncating first if
; the file has already grown past the cap above. No `un.` twin needed: unlike `SeeyaPathFind`, this
; is a `!macro` (text-substituted at every call site), never a `Function` reached through a plain
; `Call` -- the "must start with un." compiler rule this file's other comments warn about is about
; `Call`/`GetFunctionAddress`, not about macros.
!macro seeyaLogWrite instanceLabel message
  StrCpy $SeeyaLogPath "$PROFILE\.seeya\installer.log"
  CreateDirectory "$PROFILE\.seeya"
  StrCpy $SeeyaLogSize 0
  ClearErrors
  FileOpen $SeeyaLogFileHandle "$SeeyaLogPath" r
  ${ifNot} ${Errors}
    FileSeek $SeeyaLogFileHandle 0 END $SeeyaLogSize
    FileClose $SeeyaLogFileHandle
  ${endIf}
  ClearErrors
  ${if} $SeeyaLogSize > ${SEEYA_INSTALLER_LOG_MAX_BYTES}
    FileOpen $SeeyaLogFileHandle "$SeeyaLogPath" w
  ${else}
    FileOpen $SeeyaLogFileHandle "$SeeyaLogPath" a
  ${endIf}
  ${ifNot} ${Errors}
    ${GetTime} "" "L" $SeeyaLogTimeDay $SeeyaLogTimeMonth $SeeyaLogTimeYear $SeeyaLogTimeDow $SeeyaLogTimeHour $SeeyaLogTimeMinute $SeeyaLogTimeSecond
    FileSeek $SeeyaLogFileHandle 0 END
    FileWrite $SeeyaLogFileHandle "[$SeeyaLogTimeYear-$SeeyaLogTimeMonth-$SeeyaLogTimeDay $SeeyaLogTimeHour:$SeeyaLogTimeMinute:$SeeyaLogTimeSecond] [${instanceLabel}] ${message}$\r$\n"
    FileClose $SeeyaLogFileHandle
  ${endIf}
  ClearErrors
!macroend

; Runs a packaged-CLI command with `ELECTRON_RUN_AS_NODE=1` (like every other CLI call in this
; file), captures its exit code AND its printed text (`nsExec::ExecToStack`, see this section's own
; top comment on why not `ExecToLog`), prints a short line to the on-screen details view, and
; writes the full result -- command, exit code, output -- to `installer.log`.
!macro seeyaRunLoggedCli instanceLabel stepLabel command
  DetailPrint "${stepLabel}"
  !insertmacro seeyaSetRunAsNode
  nsExec::ExecToStack '${command}'
  Pop $SeeyaLogExitCode
  Pop $SeeyaLogOutput
  !insertmacro seeyaClearRunAsNode
  !insertmacro seeyaLogWrite "${instanceLabel}" "${stepLabel} -- exit $SeeyaLogExitCode -- $SeeyaLogOutput"
!macroend

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

; V2-T20 item 2: `customUnInstall`'s own `autostart disable` call's return code -- the mirror image
; of `$SeeyaDaemonRestartExitCode` above: only the UNINSTALLER half ever writes this one, so it
; carries the opposite guard (`!ifdef`, not `!ifndef`) for the identical "unreferenced variable"
; reason.
!ifdef BUILD_UNINSTALLER
  Var SeeyaAutostartDisableExitCode
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
  StrCpy $SeeyaBinDirPath "$INSTDIR\bin"
!macroend

; -----------------------------------------------------------------------------------------------
; V2-T20 item 1: "seeya" on PATH after installing (docs/PLANO-DE-ENTREGA.md V2-T20's own "medir por
; sistema antes de escolher o mecanismo" — this is the Windows measurement).
;
; **What's shipped: a `seeya.cmd` shim in `$INSTDIR\bin`, added to `HKCU\Environment\Path`.** NOT a
; shim directly inside `$INSTDIR` itself, and NOT a symlink to `${APP_EXECUTABLE_FILENAME}` --
; `$INSTDIR` already contains `seeya.exe` (the GUI binary), and Windows resolves a bare `seeya`
; typed at a prompt by PATHEXT order (`.COM`,`.EXE`,`.BAT`,`.CMD` by default), which would pick the
; GUI `.exe` over a same-directory `.cmd` every time. A SEPARATE `bin\` subdirectory, containing
; only the shim, is what lets `seeya` on PATH mean "run the CLI" without renaming or touching the
; GUI executable at all.
;
; **The shim uses `%~dp0` (its own directory) instead of a baked-in `$INSTDIR`,** so it keeps
; working if `allowToChangeInstallationDirectory` ever changes where this ships without this file
; needing to know about it, and identically to how `seeyaResolvePaths` above already recomputes
; every path from `$INSTDIR` fresh rather than caching one baked in at a different point in time.
;
; **Per-user PATH (`HKCU\Environment`), never `HKLM`'s machine-wide one** -- matches the plan's own
; wording ("acrescentar ao PATH do usuário") and needs no elevation even under a per-machine
; (`perMachine: true`, item 3's own finding) install: the CURRENT user, whoever is running this
; installer, gets `seeya` on their own next terminal either way.
;
; **No bundled EnvVarUpdate.nsh-style plugin.** That macro is a well-known community contribution,
; but it doesn't ship in this project's own `node_modules` (electron-builder's bundled NSIS
; toolset) or in `app-builder-lib`'s own template tree, and AGENTS.md bans a new dependency without
; asking. `seeyaPathFind`/`SeeyaPathFind` below are hand-written instead, built from core NSIS
; instructions already used elsewhere in this file (`StrCpy`/`StrLen`/`StrCmp`/`ReadRegStr`/
; `WriteRegExpandStr`) plus `SendMessage`, all part of the NSIS compiler this project's own
; toolchain already downloads (nothing new to fetch). Verified against seven cases (only entry,
; first/middle/last of several, absent, a same-prefix decoy that must survive, and an empty PATH)
; with a throwaway `makensis`-compiled harness before landing here -- see this task's own report
; for the case list; not part of the repo, since it never touches anything this project ships.
;
; **A separate, uniquely-named substring function, not a reuse of `StrContains.nsh`.**
; `app-builder-lib`'s own `assistedInstaller.nsh` ALREADY `!include`s that file unconditionally
; (because `allowToChangeInstallationDirectory: true` — its own directory-sanitizing check),
; measured by reading that template; a second `!include` here would double-define
; `Function StrContains` and fail the installer compile pass.
; -----------------------------------------------------------------------------------------------

; Broadcast so already-open processes (Explorer, in particular -- it hands its own cached
; environment block to whatever it launches) notice the PATH change without a reboot; a NEW
; terminal opened right after still needs this, otherwise it can inherit Explorer's stale block.
; Defined under seeya-prefixed names rather than `!include "WinMessages.nsh"` (which carries the
; plain `HWND_BROADCAST`/`WM_SETTINGCHANGE` names) purely to avoid depending on whether that core
; NSIS header happens to be include-guarded the same way in every future NSIS version this
; project's toolchain might download -- two integer literals are not worth that question.
!define SEEYA_HWND_BROADCAST 0xffff
!define SEEYA_WM_SETTINGCHANGE 0x001A

Var SeeyaPathValue
Var SeeyaPathHaystack
Var SeeyaPathNeedle
Var SeeyaPathScan
Var SeeyaPathNeedleLen
Var SeeyaPathHaystackLen
Var SeeyaPathWindow
Var SeeyaPathMatchPos

; Returns (via the stack) the 0-based offset of the first occurrence of the needle inside the
; haystack, or "-1" if it never occurs. Same brute-force scan technique
; `app-builder-lib`'s own bundled `StrContains.nsh` uses (this section's own top comment explains
; why that file's function isn't reused directly) — fine for PATH-sized strings, never called in a
; loop over anything large.
;
; **Defined twice, `SeeyaPathFind` and `un.SeeyaPathFind`, identical bodies.** Measured (a real
; `npm run dist:windows` run): NSIS's own compiler refuses `Call SeeyaPathFind` (no `un.` prefix)
; from inside the uninstaller half with "Call must be used with function names starting with
; 'un.' in the uninstall section" — `customUnInstall` (below) is exactly that section, since
; electron-builder's own two-pass build (`BUILD_UNINSTALLER`, this file's own top comment)
; compiles a standalone uninstaller binary where the ENTIRE script counts as "the uninstall
; section". `!macro SeeyaPathFindBody` holds the one body both `Function` blocks share, so the
; scan logic itself is never duplicated by hand.
!macro SeeyaPathFindBody
  Exch $SeeyaPathNeedle
  Exch
  Exch $SeeyaPathHaystack
  StrCpy $SeeyaPathMatchPos -1
  StrCpy $SeeyaPathScan -1
  StrLen $SeeyaPathNeedleLen $SeeyaPathNeedle
  StrLen $SeeyaPathHaystackLen $SeeyaPathHaystack
  seeyaPathFindLoop:
    IntOp $SeeyaPathScan $SeeyaPathScan + 1
    StrCpy $SeeyaPathWindow $SeeyaPathHaystack $SeeyaPathNeedleLen $SeeyaPathScan
    StrCmp $SeeyaPathWindow $SeeyaPathNeedle seeyaPathFindFound
    StrCmp $SeeyaPathScan $SeeyaPathHaystackLen seeyaPathFindDone
    Goto seeyaPathFindLoop
  seeyaPathFindFound:
    StrCpy $SeeyaPathMatchPos $SeeyaPathScan
  seeyaPathFindDone:
  Pop $SeeyaPathNeedle
  Exch $SeeyaPathMatchPos
!macroend

; Each `Function` block below is guarded to the ONE pass that ever calls it (see `seeyaPathFind`/
; `seeyaPathFindUn` further down) — measured: leaving either unguarded made the OTHER pass's own
; `makensis` invocation fail with "install function ... not referenced - zeroing code out", a
; warning this project's own build already treats as fatal (this file's own top comment on
; `warning 6001`).
!ifndef BUILD_UNINSTALLER
Function SeeyaPathFind
  !insertmacro SeeyaPathFindBody
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.SeeyaPathFind
  !insertmacro SeeyaPathFindBody
FunctionEnd
!endif

; Install-context caller (`seeyaAddBinDirToUserPath`, from `customInstall`).
!macro seeyaPathFind OUT HAYSTACK NEEDLE
  Push `${HAYSTACK}`
  Push `${NEEDLE}`
  Call SeeyaPathFind
  Pop ${OUT}
!macroend

; Uninstall-context caller (`seeyaRemoveBinDirFromUserPath`, from `customUnInstall`) — same
; arguments, calls the `un.`-prefixed twin above instead.
!macro seeyaPathFindUn OUT HAYSTACK NEEDLE
  Push `${HAYSTACK}`
  Push `${NEEDLE}`
  Call un.SeeyaPathFind
  Pop ${OUT}
!macroend

; Writes/overwrites `$SeeyaBinDirPath\seeya.cmd` -- idempotent, safe to call on every
; install/upgrade (an upgrade just rewrites the identical content).
!macro seeyaWriteCliShim
  CreateDirectory "$SeeyaBinDirPath"
  FileOpen $0 "$SeeyaBinDirPath\seeya.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "rem Generated by the seeya installer (V2-T20 item 1) -- dispatches to the CLI$\r$\n"
  FileWrite $0 "rem bundled inside the installed app, the same ELECTRON_RUN_AS_NODE=1 mechanism$\r$\n"
  FileWrite $0 "rem the daemon's own launcher already uses (adapters/process/daemon-launch.ts).$\r$\n"
  FileWrite $0 "rem %~dp0 is this file's own directory, so this keeps working however the app$\r$\n"
  FileWrite $0 "rem was installed or reinstalled.$\r$\n"
  FileWrite $0 "set ELECTRON_RUN_AS_NODE=1$\r$\n"
  FileWrite $0 '"%~dp0..\${APP_EXECUTABLE_FILENAME}" "%~dp0..\resources\app.asar\node_modules\@seeya-ai\cli\dist\index.js" %*$\r$\n'
  FileClose $0
!macroend

!macro seeyaRemoveCliShim
  Delete "$SeeyaBinDirPath\seeya.cmd"
  ; No /r: only removes the directory if the shim was the only thing in it -- never touches
  ; anything a person might have dropped in there themselves.
  RMDir "$SeeyaBinDirPath"
!macroend

; Adds `$SeeyaBinDirPath` to `HKCU\Environment\Path` unless it is already there (an upgrade
; reinstalling over itself must not grow the value every time).
!macro seeyaAddBinDirToUserPath
  ReadRegStr $SeeyaPathValue HKCU "Environment" "Path"
  StrCpy $SeeyaPathHaystack ";$SeeyaPathValue;"
  !insertmacro seeyaPathFind $SeeyaPathMatchPos "$SeeyaPathHaystack" ";$SeeyaBinDirPath;"
  ${if} $SeeyaPathMatchPos == -1
    ${if} $SeeyaPathValue == ""
      StrCpy $SeeyaPathValue "$SeeyaBinDirPath"
    ${else}
      StrCpy $SeeyaPathValue "$SeeyaPathValue;$SeeyaBinDirPath"
    ${endIf}
    WriteRegExpandStr HKCU "Environment" "Path" "$SeeyaPathValue"
    SendMessage ${SEEYA_HWND_BROADCAST} ${SEEYA_WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    DetailPrint "Added $SeeyaBinDirPath to your PATH -- open a new terminal for 'seeya' to be found"
  ${else}
    DetailPrint "$SeeyaBinDirPath is already on your PATH"
  ${endIf}
!macroend

; Removes exactly one ';'-delimited occurrence of `$SeeyaBinDirPath` from `HKCU\Environment\Path`
; -- never a blind string-replace, so a directory that merely shares a prefix (e.g. a hand-added
; `C:\seeya\bin2`) survives untouched. No-op, quietly, if it was never there.
!macro seeyaRemoveBinDirFromUserPath
  ReadRegStr $SeeyaPathValue HKCU "Environment" "Path"
  StrCpy $SeeyaPathHaystack ";$SeeyaPathValue;"
  !insertmacro seeyaPathFindUn $SeeyaPathMatchPos "$SeeyaPathHaystack" ";$SeeyaBinDirPath;"
  ${if} $SeeyaPathMatchPos != -1
    StrCpy $SeeyaPathWindow $SeeyaPathHaystack $SeeyaPathMatchPos
    StrLen $SeeyaPathNeedleLen ";$SeeyaBinDirPath"
    IntOp $SeeyaPathScan $SeeyaPathMatchPos + $SeeyaPathNeedleLen
    StrCpy $SeeyaPathHaystack "$SeeyaPathHaystack" "" $SeeyaPathScan
    StrCpy $SeeyaPathHaystack "$SeeyaPathWindow$SeeyaPathHaystack"
    ; $SeeyaPathHaystack is padded (";A;B;") again at this point -- strip the padding back off.
    StrLen $SeeyaPathHaystackLen $SeeyaPathHaystack
    IntOp $SeeyaPathHaystackLen $SeeyaPathHaystackLen - 2
    StrCpy $SeeyaPathValue $SeeyaPathHaystack $SeeyaPathHaystackLen 1
    WriteRegExpandStr HKCU "Environment" "Path" "$SeeyaPathValue"
    SendMessage ${SEEYA_HWND_BROADCAST} ${SEEYA_WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    DetailPrint "Removed $SeeyaBinDirPath from your PATH"
  ${endIf}
!macroend

; V2-T45 cause 2, confirmed by reading the cached template tree before writing this fix:
; `multiUserUi.nsh`'s own elevation Leave-function (`UAC_RunElevated` then `Quit`, ~lines 152-165)
; and `installer.nsi`'s own silent per-machine elevation inside `Section "install"` (same pattern,
; ~lines 99-119) BOTH run only after `.onInit` -- and therefore `customInit` -- already completed
; once, in the non-elevated ("original") process. `UAC_RunElevated` then launches a SECOND, fully
; independent process of this same installer, which runs `.onInit`/`customInit` again from
; scratch: `${UAC_IsInnerInstance}` (`include/UAC.nsh`) is what tells the two runs apart.
; Recomputing `$SeeyaDaemonWasRunning` from `daemon.lock` a second time there reads "0" --  the
; original process's own daemon-stop call, below, has already deleted the lock file by then --
; which is the actual defect the maintainer measured (autostart aside, the daemon simply never
; came back). `UAC_AsUser_GetGlobalVar` (`include/UAC.nsh`) pulls the ORIGINAL process's own copy
; of the variable across the elevation boundary instead of guessing from a lock file that may
; already be gone; it is also one fewer packaged-CLI launch (item 4): the elevated instance no
; longer needs its own redundant `daemon --stop` at all, since the original instance already ran
; it moments earlier in the same install.
!macro customInit
  !insertmacro seeyaResolvePaths
  ${if} ${UAC_IsInnerInstance}
    !insertmacro UAC_AsUser_GetGlobalVar $SeeyaDaemonWasRunning
    !insertmacro seeyaLogWrite "elevated" "Reused the original instance's own daemon state ($SeeyaDaemonWasRunning) instead of stopping it again"
  ${else}
    StrCpy $SeeyaDaemonWasRunning "0"
    IfFileExists "$SeeyaDaemonLockPath" 0 seeyaInitNoLock
      StrCpy $SeeyaDaemonWasRunning "1"
    seeyaInitNoLock:
    ; A first-time install has no OLD `${APP_EXECUTABLE_FILENAME}` on disk yet to call — nothing to
    ; stop (and `$SeeyaDaemonWasRunning` would only be "1" here from a daemon this same NSIS-driven
    ; app itself started, which needs an install to have already happened once).
    IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 seeyaInitDone
      !insertmacro seeyaRunLoggedCli "original" "Stopping the seeya daemon before installing..." '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$SeeyaCliScriptPath" daemon --stop'
    seeyaInitDone:
  ${endIf}
!macroend

; V2-T22: the defect this task fixes, measured on the maintainer's machine — this restart used to
; fail SILENTLY. `runDaemonLauncher` refused it (D-045 item 3's ownership check didn't yet know the
; app's own binary is calling itself), and `ExecWait` alone would have thrown that refusal's own
; text away: it only ever returns an exit code, never the child's stdout, and nothing here looked
; at the code either. Two independent fixes to that silence, not one:
;
; 1. **`nsExec`, not plain `ExecWait`, so the CLI's own text is captured instead of thrown away.**
;    Originally (V2-T22) `nsExec::ExecToLog` — same bundled plugin
;    `allowOnlyOneInstallerInstance.nsh` already calls elsewhere in this template tree (no new
;    dependency) — piping every line the child prints to the installer's own on-screen details log,
;    so the CLI's own message ("seeya daemon started (pid ...)", or the refusal text this task's
;    own `daemon-command.ts` fix addresses) was what a person reading that view actually saw, not
;    silence. V2-T45 moved this specific call behind `seeyaRunLoggedCli`, which uses
;    `nsExec::ExecToStack` instead (see this file's own top comment on why) so the same text also
;    reaches `~/.seeya/installer.log` — the on-screen details view is not always available for this
;    one call any more (item 3, below), so the log file is now the one place guaranteed to have it.
; 2. **The exit code, captured and checked too**, as a defensive belt: `runDaemonLauncher`'s own
;    "launcher" branch (`cli/index.ts`) does not currently set a non-zero `process.exitCode` on
;    refusal (only the worker path does) — measured while writing this fix, not assumed — so this
;    check alone would NOT have caught the original defect. It stays because a future failure mode
;    that DOES exit non-zero (a spawn failure inside `spawnDetachedDaemon`, for one) will now also
;    get its own explicit line, instead of counting on someone reading the log line above closely.
;
; V2-T45 item 3: this restart MUST run as the person, never as admin. A daemon launched directly
; from `customInstall` would inherit whatever process is running it -- for a per-machine install
; that is the ELEVATED instance (cause 2, above), so the daemon would come up elevated: the window
; could never stop it again (D-002, only graceful termination, and only the app's own daemon), and
; everything it then wrote to `~/.seeya/` would carry a different integrity level than every other
; file this app writes there.
;
; **`UAC_AsUser_Call`, not `UAC_AsUser_ExecShell` (both from `include/UAC.nsh`, both cited in this
; task's own evidence) -- measured against what each one can report back:**
; `UAC_AsUser_ExecShell` is a thin wrapper over Win32 `ShellExecute`, fire-and-forget by design --
; it returns no exit code and there is nothing to `Pop`, so `$SeeyaDaemonRestartExitCode`'s own
; failure message (V2-T22) could not be fed by it at all, and neither could `installer.log`.
; `UAC_AsUser_Call` instead runs a real `Function` IN the original, unprivileged process and syncs
; `$0`-`$9`/`$R0`-`$R9` back (`UAC_SYNCREGISTERS`) once it returns -- enough to carry the exit code
; across, and the function body can call `seeyaRunLoggedCli` itself, so the CLI's own text and exit
; code still reach `installer.log` (item 5) even though this step crosses the elevation boundary.
;
; **What neither macro preserves: the ON-SCREEN details view.** The original process's own window
; was hidden before elevation (`ShowWindow $HWNDPARENT ${SW_HIDE}`, the same elevation code this
; section's own top comment on cause 2 already cites) -- `DetailPrint` calls made while running
; inside that process write to a details list nobody is looking at. `installer.log` is what
; survives the boundary; that is why item 5 exists, and why this one step is the reason it does.
!ifndef BUILD_UNINSTALLER
Function SeeyaRestartDaemonAsUser
  ; Runs in the ORIGINAL (unprivileged) process even when `customInstall` itself is running
  ; elevated -- `UAC_AsUser_Call`, below, is what jumps here. `$INSTDIR` arrives synced
  ; (`UAC_SYNCINSTDIR`); `$SeeyaCliScriptPath` does NOT (only `$0`-`$9`/`$R0`-`$R9` do, per
  ; `UAC_AsUser_Call`'s own doc comment in `include/UAC.nsh`), so this recomputes it fresh from the
  ; now-synced `$INSTDIR` -- the same "recompute, never cache across hooks" rule
  ; `seeyaResolvePaths`'s own top comment already states, just applied across a process boundary
  ; instead of across hooks.
  !insertmacro seeyaResolvePaths
  !insertmacro seeyaRunLoggedCli "elevated" "Restarting the seeya daemon (it was running before this install)..." '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$SeeyaCliScriptPath" daemon'
  ; `$0` is the one register `UAC_AsUser_Call`'s caller reads back below (see the `Push $0` /
  ; `Pop $0` around it) -- this is the same "stash the result in a synced register, restore it
  ; after" idiom `include/UAC.nsh`'s own `UAC_AsUser_GetGlobalVar` already uses internally.
  StrCpy $0 $SeeyaLogExitCode
FunctionEnd
!endif

!macro customInstall
  ; V2-T20 item 1: independent of whether the daemon needs restarting below -- this runs on every
  ; install AND every upgrade, `$INSTDIR` already final at this point (see `seeyaResolvePaths`'s
  ; own top comment on why every hook recomputes it rather than trusting `customInit`'s copy).
  !insertmacro seeyaResolvePaths
  !insertmacro seeyaWriteCliShim
  !insertmacro seeyaAddBinDirToUserPath
  ${if} $SeeyaDaemonWasRunning == "1"
    Push $0
    !insertmacro UAC_AsUser_Call Function SeeyaRestartDaemonAsUser ${UAC_SYNCREGISTERS}|${UAC_SYNCINSTDIR}
    StrCpy $SeeyaDaemonRestartExitCode $0
    Pop $0
    ${if} $SeeyaDaemonRestartExitCode != 0
      DetailPrint "Restarting the seeya daemon failed (exit code $SeeyaDaemonRestartExitCode) -- open seeya and use Start daemon, or run 'seeya daemon' yourself."
    ${endIf}
  ${endIf}
!macroend

; V2-T20 item 2: "a desinstalação remove o autostart" -- run through the packaged CLI
; (`seeya autostart disable`, same reasoning `customInit`'s own top comment already gives for
; `daemon --stop`: it already knows how to read/remove the OS-specific registration, own tests
; cover it, and D-045 item 3 left `disable` working for every `DaemonOwner`, not just the app's own).
; Best-effort like the restart in `customInstall`: `seeyaRunLoggedCli` (V2-T45 item 5) so the CLI's
; own output ("autostart removed"/"autostart was not registered", or a failure) and its exit code
; reach `~/.seeya/installer.log`, but a non-zero exit never aborts the uninstall -- the app itself
; is already gone by the time this runs; a person can still open a terminal and run the command by
; hand if this one line failed for some OS-specific reason.
;
; V2-T45 cause 1, confirmed by reading the cached template tree before writing this fix:
; `include/installUtil.nsh#uninstallOldVersion` (called from `installSection.nsh`, on every
; install where a previous version is registered) runs the OLD uninstaller with `/S ... --updated`
; (line ~206: "always pass --updated flag"). `uninstaller.nsh`'s own `Section "un.${...}"` calls
; `customUnInstall` (line ~157) BEFORE it ever branches on `${isUpdated}` itself (lines ~164 and
; ~224, the two places the template's OWN code already treats an update differently from a real
; uninstall) -- our macro is what had not been taught the same distinction. `${isUpdated}` is
; already in scope at the point `customUnInstall` runs (the template's own later `${if}`s in that
; same function prove it), so there is no new plumbing needed to read it here, only to act on it.
!define SEEYA_UNINSTALL_LOG_LABEL "old-uninstaller"

; V2-T45 item 1: only ever called from `customUnInstall` when this is NOT an update (see there) --
; a genuine uninstall, never the OLD uninstaller electron-builder's own `uninstallOldVersion`
; (`include/installUtil.nsh`) runs on top of a fresh install.
!macro seeyaDisableAutostart
  !insertmacro seeyaRunLoggedCli "${SEEYA_UNINSTALL_LOG_LABEL}" "Removing the seeya autostart registration..." '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$SeeyaCliScriptPath" autostart disable'
  StrCpy $SeeyaAutostartDisableExitCode $SeeyaLogExitCode
  ${if} $SeeyaAutostartDisableExitCode != 0
    DetailPrint "Removing the seeya autostart registration failed (exit code $SeeyaAutostartDisableExitCode) -- run 'seeya autostart disable' yourself if it is still registered."
  ${endIf}
!macroend

!macro customUnInstall
  !insertmacro seeyaResolvePaths
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 seeyaUnInstallNoExe
    !insertmacro seeyaRunLoggedCli "${SEEYA_UNINSTALL_LOG_LABEL}" "Stopping the seeya daemon..." '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$SeeyaCliScriptPath" daemon --stop'
    ; V2-T45 item 1: an update is not an uninstall -- the NEW version's own `customInstall` is what
    ; leaves the final autostart/protocol state (it runs moments later, after this old uninstaller
    ; returns). Stopping the daemon above still always runs: the files need to be replaceable
    ; either way, and a stop against an already-stopped daemon is the same safe no-op `customInit`'s
    ; own top comment already relies on -- keeping it here is a deliberate belt-and-suspenders
    ; against the new installer's own stop having failed or not run, not an oversight left in by
    ; not reading this far.
    ${ifNot} ${isUpdated}
      !insertmacro seeyaDisableAutostart
    ${else}
      !insertmacro seeyaLogWrite "${SEEYA_UNINSTALL_LOG_LABEL}" "Skipping autostart/protocol cleanup: this uninstall is part of an update"
    ${endIf}
  seeyaUnInstallNoExe:
  ; V2-T20 item 1: undoes `customInstall`'s own `seeyaWriteCliShim`/`seeyaAddBinDirToUserPath` --
  ; unconditional (unlike the two calls above, which need the packaged exe to still be there to run
  ; `seeya` itself): removing a file and a registry value needs no exe at all, and re-adding the
  ; shim/PATH entry right after is exactly what the NEW version's own `customInstall` already does
  ; unconditionally too -- this still covers an install directory changing under
  ; `allowToChangeInstallationDirectory`, so it is left exactly as it already ran (V2-T20), update
  ; or not.
  !insertmacro seeyaRemoveCliShim
  !insertmacro seeyaRemoveBinDirFromUserPath
  ${ifNot} ${isUpdated}
    DeleteRegKey HKCU "Software\Classes\seeya"
  ${endIf}
!macroend
