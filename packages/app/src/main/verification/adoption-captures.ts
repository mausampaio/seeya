/**
 * The adoption-flow and select-states directory captures (V2-T70/V2-T81; V2-T51: moved out of
 * `main/main.ts`).
 */
import path from 'node:path';
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { quitAfterConfiguredDelay } from './quit-after.js';

/**
 * V2-T70 (`docs/INTERFACE.md` § 7): drives the real single adoption dialog end to end — step 1
 * in `Existing project` mode (a fresh workspace's own empty list, or a pre-seeded project already
 * selected — see the `commitWillFail` branch below), step 1 in `New project` mode with an invalid
 * id typed, step 2 (review, with real type/line-count data from the fake fork's own writes), and
 * the result (success or failure, depending on whether `SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE`
 * is ALSO set for this run — in which case the `New project` sub-flow and its own screenshot are
 * skipped, since that mode would fail at project CREATION rather than at the review commit this
 * flag means to prove; the `run.mjs` driver instead points `SEEYA_APP_HOME_OVERRIDE` at a home a
 * prior SUCCESS run already adopted into, so `Existing project` has it pre-selected). Only ever
 * meaningful combined with `SEEYA_APP_VERIFY_ADOPTION_FAKE` (never a real `claude` launch) and a
 * `SEEYA_APP_HOME_OVERRIDE` whose Sessions tab already has exactly one adopt-eligible fixture
 * session — `[data-adopt-session-id]` (`SessionsTable.tsx`) is clicked whichever row it's on, the
 * first (and, in that fixture, only) one found.
 */
export async function captureAdoptionFlowVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  // `?` before every DOM read below — a selector this own verification instrumentation expects
  // to exist (the fixture home's own fork launcher/discovery timing) is never guaranteed to be
  // there the instant this script runs; calling a native setter with `this === null` throws
  // "Illegal invocation" (confirmed against a real run of this instrumentation before this
  // guard), crashing the renderer instead of just skipping a step that found nothing.
  function click(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`!!document.getElementById('${id}')?.click();`);
  }
  function clickFirst(selector: string): Promise<unknown> {
    return window.webContents.executeJavaScript(
      `!!document.querySelector('${selector}')?.click();`,
    );
  }
  function setFieldValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('${id}');
        if (!el) { return false; }
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })();
    `);
  }
  // Polls instead of a fixed sleep for the two steps whose timing depends on a REAL round trip
  // (project creation via `git init`+commit, the project lock, the fake launcher's own delay, and
  // the `confirmCommit` IPC event back to the renderer) rather than a fixed animation — a fixed
  // sleep here either wastes time on a fast machine or, under load, shoots before the dialog
  // reaches the state being proven. Deadline math uses the injected `Clock` (D-019), never
  // `Date.now()` directly.
  async function waitForElement(id: string, timeoutMs: number): Promise<boolean> {
    const deadline = clock.now().getTime() + timeoutMs;
    for (;;) {
      const found: unknown = await window.webContents.executeJavaScript(
        `!!document.getElementById('${id}');`,
      );
      if (found === true) {
        return true;
      }
      if (clock.now().getTime() >= deadline) {
        return false;
      }
      await clock.sleep(200);
    }
  }

  // `SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE` run: proving the REVIEW step's own commit
  // failing needs `ensureProjectExists` to take its `alreadyExists` branch (never calling
  // `commitAll` itself) — the wrapped workspace fails EVERY `commitAll`, project creation
  // included, so a `New project` pick would fail before ever reaching the review step. The
  // `run.mjs` driver that sets this flag always points `SEEYA_APP_HOME_OVERRIDE` at a home a
  // prior SUCCESS run already adopted into, so `Existing project` (this dialog's own default
  // mode) already has that project pre-selected — no typing needed, just submit.
  const commitWillFail = process.env.SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE !== undefined;

  await clock.sleep(1500);
  await click('sessions-link');
  await clock.sleep(800);
  await clickFirst('[data-adopt-session-id] button');
  await clock.sleep(500);
  await shoot('01-pick-existing-project.png');

  if (commitWillFail) {
    await click('adoption-pick-submit-button');
  } else {
    await click('adoption-pick-new-option');
    await clock.sleep(200);
    await setFieldValue('adoption-pick-new-project-id-input', 'Invalid ID!');
    await clock.sleep(300);
    await click('adoption-pick-submit-button'); // triggers the inline validation error
    await clock.sleep(300);
    await shoot('02-pick-new-project-invalid-id.png');

    await setFieldValue('adoption-pick-new-project-id-input', 'adoption-fixture-project');
    await clock.sleep(800); // the live-preview round trip (CHANNELS.previewAdoptionLaunch)
    await click('adoption-pick-submit-button');
  }
  // the fake fork "runs" (ADOPTION_FAKE_DELAY_MS) and writes its files, then `confirmCommit`
  // round-trips to the renderer — real `git init`+commit for project creation included.
  await waitForElement('adoption-review-commit-button', 20000);
  await clock.sleep(300); // let the review list finish painting
  await shoot('03-review-changes.png');

  await click('adoption-review-commit-button');
  // A loaded machine (many concurrent `claude`/build processes — this instrumentation's own real
  // usual environment) occasionally loses this first click before Preact's own listener is fully
  // attached; one retry at the halfway point costs nothing on a fast machine (the element is
  // already gone by then, so the click is a harmless no-op) and recovers the slow one.
  const reachedResultFast = await waitForElement('adoption-result-close-button', 5000);
  if (!reachedResultFast) {
    await click('adoption-review-commit-button');
  }
  await waitForElement('adoption-result-close-button', 15000);
  await clock.sleep(300);
  await shoot(commitWillFail ? '04-result-failure.png' : '04-result.png');

  // SEEYA_APP_VERIFY_ADOPTION_RESULT_BUTTON (V2-T82 item 1): `close` or `open` — clicks that real
  // button of the result step. The proof is NOT in this function: `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG`'s
  // own file gets a line only when the real `openProject` pipeline ran, so the script that launched
  // this process reads that file afterwards (no line = Close never opened anything).
  const resultButton = process.env.SEEYA_APP_VERIFY_ADOPTION_RESULT_BUTTON;
  if (resultButton === 'close') {
    await click('adoption-result-close-button');
    await clock.sleep(8000);
  } else if (resultButton === 'open') {
    await click('adoption-result-open-project-button');
    await clock.sleep(8000);
  }

  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T81 (`renderer/components/Select/`): captures every place the select and the Snooze menu
 * appear, in whichever theme the fixture home's own `config.json` names, so the two can be
 * compared side by side. Never drives anything with side effects: it only opens/closes lists and
 * moves keyboard focus (real key events through `sendInputEvent`, not synthetic DOM ones), and the
 * adoption dialog is only ever OPENED to its first step (`SEEYA_APP_VERIFY_ADOPTION_FAKE` keeps a
 * real `claude` out of reach regardless). Files, in order: `01-sessions-filters-closed`,
 * `02-project-list-open`, `03-directory-list-open` (long path), `04-directory-keyboard-focus`
 * (ArrowDown/ArrowDown/ArrowDown), `05-today-resume-in-open` (mono), `06-snooze-menu-open`,
 * `07-adoption-project-open` (inside the modal dialog); plus `focus-after-escape.txt`, the id of
 * the element holding focus after Esc closed the project list (the trigger, when it works).
 */
export async function captureSelectStatesVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function run(script: string): Promise<unknown> {
    return window.webContents.executeJavaScript(script);
  }
  function click(selector: string): Promise<unknown> {
    return run(`!!document.querySelector(${JSON.stringify(selector)})?.click();`);
  }
  async function pressKey(keyCode: string): Promise<void> {
    // Same reason as `captureSessionsTabStatesVerification`'s own clipboard click: an offscreen
    // window never got real OS focus, and key events only reach the focused element once the
    // document itself is focused (`window.focus()` never `.show()`s this invisible window).
    window.focus();
    window.webContents.focus();
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
    await clock.sleep(400);
  }

  // No ownership-transition dismiss here: the driver pre-writes the declined answer into the
  // disposable home (`daemon-ownership-transition.json`), so that dialog never appears.
  await clock.sleep(2600);

  await click('#sessions-link');
  await clock.sleep(1200);
  await shoot('01-sessions-filters-closed.png');
  // Real layout numbers (V2-T81 PO review): the rendered width of every header cell, the table
  // against its container, and the horizontal overflow of the page region — read with
  // `getBoundingClientRect()` in the real bundle, never estimated from CSS.
  const tableMetrics = await run(`(() => {
    const table = document.querySelector('#page-sessions table');
    if (!table) { return null; }
    const box = table.getBoundingClientRect();
    const parent = table.parentElement.getBoundingClientRect();
    const scroller = table.closest('[class*="scroll"]') || table.parentElement;
    return {
      windowInnerWidth: window.innerWidth,
      tableWidth: box.width,
      containerWidth: parent.width,
      scrollerScrollWidth: scroller.scrollWidth,
      scrollerClientWidth: scroller.clientWidth,
      headerWidths: [...table.querySelectorAll('th')].map((th) => [th.textContent, Math.round(th.getBoundingClientRect().width * 10) / 10]),
    };
  })()`);
  await writeFile(
    path.join(outDir, 'sessions-table-metrics.json'),
    JSON.stringify(tableMetrics, null, 2),
  );

  await click('#sessions-filter-project');
  await clock.sleep(300);
  await shoot('02-project-list-open.png');
  await pressKey('Escape');
  await clock.sleep(200);
  const focused = await run('document.activeElement && document.activeElement.id');
  await writeFile(path.join(outDir, 'focus-after-escape.txt'), String(focused));

  await click('#sessions-filter-directory');
  await clock.sleep(300);
  await shoot('03-directory-list-open.png');
  await pressKey('Down');
  await pressKey('Down');
  await pressKey('Down');
  // What holds focus after the three real ArrowDown presses (the fourth option's text, when the
  // roving focus works) — written next to the capture so the focus ring can be checked against it.
  const focusedOption = await run(
    "document.activeElement ? document.activeElement.getAttribute('role') + ':' + document.activeElement.textContent : 'none'",
  );
  await writeFile(path.join(outDir, '04-focused-element.txt'), String(focusedOption));
  await shoot('04-directory-keyboard-focus.png');
  await pressKey('Escape');
  await clock.sleep(200);

  await click('#today-card');
  await clock.sleep(600);
  await click('[id^="today-resume-in-"]');
  await clock.sleep(300);
  const resumeInMetrics = await run(`(() => {
    const trigger = document.querySelector('[id^="today-resume-in-"]');
    const card = trigger.closest('li, section, article, div[class*="card"]');
    return {
      triggerWidth: trigger.getBoundingClientRect().width,
      notice: trigger.parentElement.parentElement.getBoundingClientRect().width,
      triggerText: trigger.textContent,
    };
  })()`);
  await writeFile(
    path.join(outDir, 'resume-in-metrics.json'),
    JSON.stringify(resumeInMetrics, null, 2),
  );
  await shoot('05-today-resume-in-open.png');
  await pressKey('Escape');
  await clock.sleep(200);

  await click('#schedule-strip-snooze-button');
  await clock.sleep(300);
  await shoot('06-snooze-menu-open.png');
  await pressKey('Escape');
  await clock.sleep(200);

  await click('#sessions-link');
  await clock.sleep(500);
  await click('[data-adopt-session-id] button');
  await clock.sleep(600);
  await click('#adoption-pick-existing-select');
  await clock.sleep(300);
  await shoot('07-adoption-project-open.png');

  await quitAfterConfiguredDelay(clock);
}
