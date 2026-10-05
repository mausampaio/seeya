/** The Sessions-tab directory capture (V2-T68; V2-T51: moved out of `main/main.ts`). */
import path from 'node:path';
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { quitAfterConfiguredDelay } from './quit-after.js';

/**
 * V2-T68 (`docs/INTERFACE.md` § 5): ten screenshots from one window, visiting every state the
 * Sessions tab's own aceite needs. Combined with `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1` AND
 * `SEEYA_APP_VERIFICATION_TAB_PID_PATH` (both pre-existing, V2-T75 PO review round 3's own
 * mechanism, reused by `captureProjectsTabStatesVerification` above for the identical reason): the
 * first long sleep below gives an EXTERNAL verification script the same window that function's own
 * 33000ms bucket already budgets for — reading the pid `CHANNELS.createTab`'s own handler just
 * wrote, folding it into a REAL, alive session record on disk (same pid, real `procStart` read
 * from the OS — `matchedTabId` only ever compares `pid`, `sidebar/session-match.ts`'s own "só por
 * pid", so this row reads `alive` AND `Go to tab` at once) before this function's own first
 * capture. Every other session in the fixture is static content, present from launch — a `cwd`
 * inside a real project directory (empty action cell), one eligible for `Adopt…`, one already
 * adopted (`adoptions.json`, disabled with the reason), one with a deliberately long name/directory
 * (truncation), and two pairs reachable ONLY by the direct id lookup (V2-T55), outside
 * `relevanceHours`: a single hit and an ambiguous one, sharing the fixed prefixes
 * `'33333333'`/`'44444444'` this function's own search steps type in.
 *
 * `01-table.png`: the full table — `Go to tab`, `Resume`+`Adopt…` enabled, `Resume`+`Adopt…`
 * disabled (reason), the empty project cell, and the long name/directory truncated.
 * `02-filter-running.png`/`03-filter-not-running.png`: the two non-`all` state filters.
 * `04-filter-project.png`/`05-filter-directory.png`: a real project, a real directory.
 * `06-search-name.png`: a name query narrowing the table. `07-search-id-outside-window.png`: an id
 * prefix matching only the direct lookup. `08-search-id-ambiguous.png`: a prefix matching two.
 * `09-search-no-result.png`: a hex-shaped prefix matching nothing anywhere. `10-copy-id.png`: the
 * short id button after a real clipboard copy, showing `Copied!` in place of the id.
 * `11-adopt-tooltip.png`: best-effort — a real, hovered (not clicked) pointer over the disabled
 * `Adopt…`, long enough for Chromium's own tooltip delay; see this function's own body for why
 * this one specific capture isn't guaranteed to show anything on an offscreen window.
 */
export async function captureSessionsTabStatesVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function click(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`document.getElementById('${id}')?.click();`);
  }
  function setFieldValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('${id}');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })();
    `);
  }
  function setSelectValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        // V2-T81: \`Select\` is a trigger button + a listbox of \`role="option"\` items (every item
        // is always in the DOM — the Popover only hides its dialog), not a native <select>: choose
        // an option exactly as a click would, through its own \`data-value\`.
        const trigger = document.getElementById('${id}');
        if (!trigger) { return; }
        const listbox = document.getElementById(trigger.getAttribute('aria-controls') || '');
        const option = [...(listbox ? listbox.querySelectorAll('[role="option"]') : [])]
          .find((o) => o.getAttribute('data-value') === ${JSON.stringify(value)});
        if (option) { option.click(); }
      })();
    `);
  }
  // A plain `el.click()` via `executeJavaScript` carries no real user activation — the Async
  // Clipboard API (`navigator.clipboard.writeText`, `SessionIdCopyButton`'s own call) silently
  // rejects a write triggered that way, same "denied permission" branch a sandboxed/headless
  // context already handles (`SessionIdCopyButton`'s own docstring) — confirmed against a real run
  // of THIS instrumentation: the row stayed `[22222222]`, never `Copied!`. `sendInputEvent` is
  // Electron's own synthetic-but-TRUSTED input path (same mechanism offscreen rendering is driven
  // by in general), which Chromium accepts as real user input for Clipboard API purposes — the
  // same reasoning V2-T74's own `verifyMenuAndClipboard` already uses `webContents.copy()` for
  // instead of a scripted click, just at the DOM-button layer here rather than the menu-role layer.
  async function clickCopyButtonFor(sessionId: string): Promise<void> {
    const rect = (await window.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('[data-session-id="${sessionId}"]');
        if (!el) { return null; }
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      })();
    `)) as { x: number; y: number } | null;
    if (rect === null) {
      return;
    }
    // The Async Clipboard API refuses outright with "Document is not focused" on a window this
    // offscreen/headless (`SEEYA_APP_OFFSCREEN`) run never gave real OS focus to — `window.focus()`
    // sets Chromium's own document-focus state without ever calling `.show()` (this window stays
    // invisible exactly as `SEEYA_APP_OFFSCREEN` intends), confirmed against a real run of this
    // instrumentation: the SAME write rejected with that exact message before this call was added.
    window.focus();
    window.webContents.sendInputEvent({
      type: 'mouseDown',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1,
    });
    window.webContents.sendInputEvent({
      type: 'mouseUp',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1,
    });
  }

  await clock.sleep(1500); // after SEEYA_APP_AUTO_OPEN_SHELL_TAB's own tab has opened
  await click('sessions-link');
  // See this function's own docstring — the same external-fixture-plus-ambient-refresh wait
  // `captureProjectsTabStatesVerification`'s own bucket already budgets for a single-shot capture.
  await clock.sleep(33000);
  await shoot('01-table.png');

  await click('sessions-filter-state-running');
  await clock.sleep(300);
  await shoot('02-filter-running.png');

  await click('sessions-filter-state-not-running');
  await clock.sleep(300);
  await shoot('03-filter-not-running.png');

  await click('sessions-filter-state-all');
  await clock.sleep(300);

  await setSelectValue('sessions-filter-project', 'seeya-verification-project');
  await clock.sleep(300);
  await shoot('04-filter-project.png');
  await setSelectValue('sessions-filter-project', 'any');
  await clock.sleep(300);

  await window.webContents.executeJavaScript(`
    (() => {
      const trigger = document.getElementById('sessions-filter-directory');
      const listbox = trigger ? document.getElementById(trigger.getAttribute('aria-controls') || '') : null;
      const option = listbox ? [...listbox.querySelectorAll('[role="option"]')].find((o) =>
        o.textContent.includes('directory-filter-demo') || (o.title || '').includes('directory-filter-demo')
      ) : undefined;
      if (option) { option.click(); }
    })();
  `);
  await clock.sleep(300);
  await shoot('05-filter-directory.png');
  await setSelectValue('sessions-filter-directory', 'any');
  await clock.sleep(300);

  await setFieldValue('sessions-search-input', 'Payments');
  await clock.sleep(300);
  await shoot('06-search-name.png');

  await setFieldValue('sessions-search-input', '33333333');
  await clock.sleep(1200); // the direct, unwindowed lookup's own round trip
  await shoot('07-search-id-outside-window.png');

  await setFieldValue('sessions-search-input', '44444444');
  await clock.sleep(1200);
  await shoot('08-search-id-ambiguous.png');

  await setFieldValue('sessions-search-input', 'ffffff00');
  await clock.sleep(1200);
  await shoot('09-search-no-result.png');

  await setFieldValue('sessions-search-input', '');
  await clock.sleep(300);
  await clickCopyButtonFor('22222222-2222-4222-8222-222222222222');
  await clock.sleep(300);
  await shoot('10-copy-id.png');

  // PO review round 1: a best-effort attempt at the disabled `Adopt…`'s own native `title`
  // tooltip — `sendInputEvent({ type: 'mouseMove', ... })` is the same trusted-input path
  // `clickCopyButtonFor` above already uses for the Clipboard API, hovered long enough for
  // Chromium's own tooltip delay. Native tooltips are an OS-level overlay outside the page's own
  // compositor surface; whether `capturePage()` (an offscreen window to begin with) ever includes
  // one is unconfirmed as of writing — `11-adopt-tooltip.png` is written either way, and the
  // row/button's own `title` attribute (asserted directly in `SessionsTable.test.tsx`) is the
  // guaranteed proof this capture is only a bonus attempt at.
  const disabledAdoptRect = (await window.webContents.executeJavaScript(`
    (() => {
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.disabled && b.textContent.includes('Adopt')
      );
      if (!button) { return null; }
      const r = button.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })();
  `)) as { x: number; y: number } | null;
  if (disabledAdoptRect !== null) {
    window.webContents.sendInputEvent({
      type: 'mouseMove',
      x: disabledAdoptRect.x,
      y: disabledAdoptRect.y,
    });
    await clock.sleep(1500); // typical native tooltip delay
    await shoot('11-adopt-tooltip.png');
  }

  await quitAfterConfiguredDelay(clock);
}
