/**
 * `SEEYA_APP_VERIFY_MENU_AND_CLIPBOARD_PATH`'s own proof (V2-T74; V2-T51: moved out of
 * `main/main.ts`).
 */
import { writeFile } from 'node:fs/promises';
import { BrowserWindow, clipboard, Menu } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

/** The exact string `verifyMenuAndClipboard`'s text-field round trip types into
 * `#new-project-id-input`, copies out, clears, and expects back after a `webContents.paste()` —
 * distinctive enough that it can never collide with a real project id a person typed. */
const CLIPBOARD_TEXT_FIELD_MARKER = 'seeya-v2t74-field-marker';

/** The exact string `verifyMenuAndClipboard`'s terminal check writes to the OS clipboard and
 * expects to see echoed back into the pty's own visible output after a `webContents.paste()` —
 * distinctive enough to never appear in a shell's own banner by coincidence. */
const CLIPBOARD_TERMINAL_MARKER = 'seeya-v2t74-terminal-marker';

/**
 * V2-T74: round-trips `CLIPBOARD_TEXT_FIELD_MARKER` through a REAL text field
 * (`#new-project-id-input`, opened by `#new-project-button`) using the same `webContents.copy()`
 * `webContents.paste()` Electron calls a menu's Cut/Copy/Paste role would otherwise trigger — the
 * one proof this task's own aceite needs that survives even with the application menu removed
 * entirely (`applyApplicationMenuPolicy`'s own `'none'` branch, Windows/Linux). Closes the dialog
 * again with `#new-project-cancel`, leaving no trace in `~/.seeya/`.
 */
async function verifyTextFieldClipboardRoundTrip(
  window: BrowserWindow,
  clock: Clock,
): Promise<{ copiedText: string; pastedBack: string }> {
  await window.webContents.executeJavaScript(`
    (() => {
      document.getElementById('new-project-button').click();
      const input = document.getElementById('new-project-id-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(CLIPBOARD_TEXT_FIELD_MARKER)});
      input.select();
    })();
  `);
  window.webContents.copy();
  // Electron 44's own `clipboard` module is promise-based (`electron.d.ts`'s own
  // `readText(): Promise<string>`, checked against the installed package before writing this —
  // older Electron versions documented this synchronously, and assuming that from memory would
  // have been exactly the "erro clássico" AGENTS.md warns against). Measured: reading back
  // IMMEDIATELY after `.copy()` sometimes raced ahead of the main process actually receiving the
  // OS clipboard write (`copiedText` came back empty once, even though the later `.paste()` below
  // proved the real clipboard DID hold the marker) — this short wait is what fixed it.
  await clock.sleep(100);
  const copiedText = await clipboard.readText();
  await window.webContents.executeJavaScript(`
    (() => {
      const input = document.getElementById('new-project-id-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '');
      input.focus();
    })();
  `);
  window.webContents.paste();
  const pastedBack = (await window.webContents.executeJavaScript(
    "document.getElementById('new-project-id-input').value",
  )) as string;
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-cancel').click();",
  );
  return { copiedText, pastedBack };
}

/**
 * V2-T74: proves a paste into the real embedded terminal (`@xterm/xterm`, opened by
 * `SEEYA_APP_AUTO_OPEN_SHELL_TAB`) still works with no application menu present at all.
 *
 * **Why `webContents.paste()` targeting `.xterm-helper-textarea` is the real mechanism, not a
 * shortcut around it.** Read from the installed package before writing this function
 * (`node_modules/@xterm/xterm/lib/xterm.js`): `@xterm/xterm` registers its own `'paste'` listener
 * on both its hidden textarea and its outer element (`handlePasteEvent`), and its own `'copy'`
 * listener on the terminal element when a selection exists (`copyHandler`) — the exact standard
 * DOM `ClipboardEvent`s `webContents.paste()`/`.copy()` dispatch, independent of whether any
 * `Menu` exists. A real `Ctrl+V` keypress or a macOS menu's Paste role ends up triggering the same
 * event this function triggers directly.
 *
 * Reads the pasted marker back from `.xterm-rows` — the DOM renderer's own row container
 * (`@xterm/xterm` ships no WebGL/canvas addon here, `packages/app/package.json`, so the default
 * DOM renderer is what's mounted, and its rendered text is readable `textContent`, never a canvas
 * pixel this function would have no way to read). `helperTextareaFound`/`activeElementDebug`/
 * `terminalTextSnapshot` ride along in the result — this IS the verification report, so a run
 * that comes back `false` should say why (no textarea mounted yet? focus landed somewhere else?)
 * rather than a bare boolean someone has to re-run with print statements to explain.
 */
async function verifyTerminalPaste(
  window: BrowserWindow,
  clock: Clock,
): Promise<{
  markerVisibleInTerminal: boolean;
  helperTextareaFound: boolean;
  activeElementDebug: string;
  terminalTextSnapshot: string;
}> {
  await clipboard.writeText(CLIPBOARD_TERMINAL_MARKER);
  const helperTextareaFound = (await window.webContents.executeJavaScript(
    "document.querySelector('.xterm-helper-textarea') !== null",
  )) as boolean;
  await window.webContents.executeJavaScript(
    "document.querySelector('.xterm-helper-textarea')?.focus();",
  );
  const activeElementDebug = (await window.webContents.executeJavaScript(
    "document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className : 'null'",
  )) as string;
  window.webContents.paste();
  await clock.sleep(1500);
  const terminalText = (await window.webContents.executeJavaScript(
    "document.querySelector('.xterm-rows')?.textContent ?? '<no .xterm-rows>'",
  )) as string;
  return {
    markerVisibleInTerminal: terminalText.includes(CLIPBOARD_TERMINAL_MARKER),
    helperTextareaFound,
    activeElementDebug,
    terminalTextSnapshot: terminalText.slice(0, 400),
  };
}

/**
 * V2-T74: verification-only instrumentation proving two facts a `capturePage()` screenshot cannot
 * show at all — `webContents.capturePage()` only ever captures the web contents (the HTML the
 * renderer paints), never the native window chrome a menu bar is part of, on an offscreen window
 * or not (this task's own aceite names exactly this limitation). Reads `Menu.getApplicationMenu()`
 * and `window.isMenuBarVisible()` straight from Electron, and — only when
 * `SEEYA_APP_AUTO_OPEN_SHELL_TAB` is ALSO set, so a real pty already exists to paste into — proves
 * copy/paste still works via `verifyTextFieldClipboardRoundTrip`/`verifyTerminalPaste` above.
 *
 * Writes one JSON file to `outputPath`; never read by `npm run app`, same "instrumentação só do
 * spike" discipline as every other `SEEYA_APP_*` flag in this file.
 */
export async function verifyMenuAndClipboard(
  window: BrowserWindow,
  clock: Clock,
  outputPath: string,
): Promise<void> {
  const applicationMenu = Menu.getApplicationMenu();
  const menuState = {
    platform: process.platform,
    applicationMenuIsNull: applicationMenu === null,
    menuItemLabels: applicationMenu?.items.map((item) => item.label) ?? null,
    isMenuBarVisible: window.isMenuBarVisible(),
  };

  if (process.env.SEEYA_APP_AUTO_OPEN_SHELL_TAB !== '1') {
    const payload = { menuState, clipboard: { skipped: 'SEEYA_APP_AUTO_OPEN_SHELL_TAB not set' } };
    await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    return;
  }

  // Long enough after load for SEEYA_APP_AUTO_OPEN_SHELL_TAB's own three-step sequence (~900ms
  // total, this file's own comment on that flag) to have opened the shell tab and for its prompt
  // to have printed.
  await clock.sleep(3000);
  const textField = await verifyTextFieldClipboardRoundTrip(window, clock);
  const terminal = await verifyTerminalPaste(window, clock);
  const payload = { menuState, clipboard: { textField, terminal } };
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
}
