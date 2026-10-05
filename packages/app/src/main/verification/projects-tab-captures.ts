/**
 * The Projects-tab and button-centering directory captures (V2-T51: moved out of
 * `main/main.ts`).
 */
import path from 'node:path';
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { quitAfterConfiguredDelay } from './quit-after.js';

/**
 * V2-T67 (`docs/INTERFACE.md` § 4): six screenshots from one window, visiting every state the
 * Projects tab's own aceite needs. Combined with `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1` AND
 * `SEEYA_APP_VERIFICATION_TAB_PID_PATH` (both pre-existing, V2-T75 PO review round 3's own
 * mechanism): the first long sleep below gives an EXTERNAL verification script the SAME window
 * `usesTabPidFixture`'s own 35000ms bucket already budgets for — reading the pid that
 * `CHANNELS.createTab`'s own handler just wrote, folding it into a fixture session file on disk
 * (`cwd` pointed at one project's own directory — `matchingTabId` only ever compares `pid`, so the
 * fixture's own claimed `cwd` never has to be where the real shell's OS cwd actually is), and
 * waiting for the next ambient refresh tick (`REFRESH_INTERVAL_MS`, 10s) to fold that into
 * `ProjectsPanelData` — before this function's own first capture, so that project's own row
 * already reads `openHere` in it. The other two lock states (a project that's simply unlocked, one
 * `.seeya-lock`'d by a real decoy process) are plain, static fixture content, present from launch.
 *
 * `01-table.png`: the full table — three lock states, one favorite, the `Ignored projects` section
 * below it (a `seeya.json` the fixture deliberately fails to validate). `02-search-active.png`: a
 * query that narrows the table to one matching row. `03-no-match.png`: a query matching nothing.
 * `04-filter-running.png`/`05-filter-locked.png`: each named filter selected (`ProjectsFilters.tsx`'s
 * own stable `id`s, added by this task for exactly this). The filter is reset to `all` before the
 * dialog shot so `06-new-project-dialog.png` shows the SAME table underneath it the first shot
 * did, dialog open on top.
 */
export async function captureProjectsTabStatesVerification(
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

  await clock.sleep(1500); // after SEEYA_APP_AUTO_OPEN_SHELL_TAB's own tab has opened
  await click('all-projects-link');
  // See this function's own docstring — the same external-fixture-plus-ambient-refresh wait
  // `usesTabPidFixture`'s own bucket already budgets for a single-shot capture.
  await clock.sleep(33000);
  await shoot('01-table.png');

  await setFieldValue('projects-search-input', 'payments');
  await clock.sleep(300);
  await shoot('02-search-active.png');

  await setFieldValue('projects-search-input', 'zzz-no-project-named-this');
  await clock.sleep(300);
  await shoot('03-no-match.png');

  await setFieldValue('projects-search-input', '');
  await clock.sleep(300);
  await click('projects-filter-running');
  await clock.sleep(300);
  await shoot('04-filter-running.png');

  await click('projects-filter-locked');
  await clock.sleep(300);
  await shoot('05-filter-locked.png');

  await click('projects-filter-all');
  await clock.sleep(300);
  await click('new-project-button');
  await clock.sleep(300);
  await shoot('06-new-project-dialog.png');

  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T79 (`Button.tsx`'s own off-center defect, found in a real installer screenshot): three
 * screenshots proving the fix — Open (Projects tab, one unlocked project), Skip today (sidebar
 * footer, schedule configured so `canSkip` is true) and Create (New project dialog) all centered
 * at rest, plus Skip today again while `loading` is true (the exact shape the defect broke).
 *
 * Far simpler than `captureProjectsTabStatesVerification` above: this task needs only ONE
 * unlocked project (no `openHere`/`lockedByOther` decoys, so none of that function's own pid/decoy
 * fixture machinery applies here) and the sidebar footer, which renders beside every main tab, so
 * the very first screenshot already proves Open AND Skip today at once. `03-loading.png` relies on
 * `SEEYA_APP_VERIFY_HOLD_SKIP_MS` (this file's own `holdForVerification`) being set alongside this
 * directory — a real click on the real button, with the real IPC response held open long enough
 * for the capture below to land inside the loading window instead of racing it.
 */
export async function captureButtonCenteringVerification(
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

  await clock.sleep(2000); // initial load + the ambient daemon-ownership-transition dismiss, if any
  await click('all-projects-link');
  await clock.sleep(2500); // the first getProjectsPanel fetch/render
  // Open (the table's lone unlocked project) AND Skip today (the footer, always rendered beside
  // whichever main tab is active) — both at rest, in the same frame.
  await shoot('01-open-and-skip.png');

  await click('new-project-button');
  await clock.sleep(300);
  await shoot('02-create.png');

  await click('new-project-cancel');
  await clock.sleep(300);
  await click('schedule-strip-skip-button');
  // `SEEYA_APP_VERIFY_HOLD_SKIP_MS` keeps the real response pending well past this sleep — see
  // that flag's own docstring for why a fixed delay here never has to race the real write.
  await clock.sleep(300);
  await shoot('03-loading.png');

  await quitAfterConfiguredDelay(clock);
}
