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
!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\seeya"
!macroend
