// V2-T12 item 2: guards packages/app/package.json's own "description" field against the
// shortcut-icon corruption this task fixed (docs/PLANO-DE-ENTREGA.md V2-T12). electron-builder's
// own NSIS template writes this exact field into two places: the Start Menu shortcut's own
// description (app-builder-lib/templates/nsis/include/installer.nsh:
// `CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"`, where
// APP_DESCRIPTION is package.json's own "description", set in NsisTarget.js) and the .deb
// package's own "Description:" control field (electron-builder derives one from the other) --
// so this one field guards both installer targets.
//
// **Measured, not assumed.** A disposable .lnk created in $env:TEMP (never the maintainer's real
// installed shortcut, never anything inside this repository), via WScript.Shell COM automation --
// the same tool the maintainer used to read the corrupted field on the real, NSIS-built shortcut:
//   len= 260 okIcon=True  readIcon='C:\WINDOWS\System32\notepad.exe,0'
//   len= 261 okIcon=False readIcon=',0'
//   len= 285 okIcon=False readIcon='??e,0'
//   len= 300 okIcon=False readIcon='???????,0'
// A Description of 260 characters round-trips through IShellLinkW intact. At 261 characters,
// WshShortcut.Description silently truncates to 260 chars on write AND clobbers the shortcut's
// own IconLocation field -- read back as a bare ",0", no path at all; past ~285 characters,
// garbled path fragments start bleeding into IconLocation too. This is the exact symptom the
// maintainer originally reported from the real installed shortcut: "the end of the description
// text, followed by a truncated relative path, then ,0". packages/app/package.json's own
// "description" was ~500 characters before this task (item 1) -- comfortably over the
// 260-character hard limit.
//
// DESCRIPTION_LENGTH_LIMIT sits well under that measured 260-character hard limit: 200 leaves
// ~60 characters of margin for a future rewording without re-measuring, while still forcing a
// genuinely short, tooltip-sized sentence instead of an architectural paragraph.
export const DESCRIPTION_LENGTH_LIMIT = 200;

/**
 * @param {string} description
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkDescriptionLength(description) {
  if (description.length > DESCRIPTION_LENGTH_LIMIT) {
    return {
      ok: false,
      reason: `packages/app/package.json's own "description" is ${String(description.length)} characters, expected at most ${String(DESCRIPTION_LENGTH_LIMIT)} (a Windows shortcut description over 260 characters corrupts the shortcut's own icon field -- measured, see this file's own docstring): "${description}"`,
    };
  }
  return { ok: true };
}
