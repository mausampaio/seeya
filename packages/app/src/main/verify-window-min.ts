/**
 * V2-T77: `SEEYA_APP_VERIFY_WINDOW_MIN_DIR` — proof of the window's floor (`composition/
 * window-size.ts`), the one thing a unit test cannot show: whether the REAL layout still fits at
 * that size. Verification-only instrumentation, same class as every other `SEEYA_APP_*` flag (never
 * read by `npm run app` or the README); lives in its own file so `main.ts` does not grow.
 *
 * Writes into the given DIRECTORY (same "a directory, not a file" shape as the other
 * `..._DIR` flags): `01-projects-tab.png` (the Projects tab at whatever size the window opened),
 * `02-settings-<section>.png` for the Schedule/Capture/Discovery/Terminal sections of Settings (the
 * tallest dialog, with its `Done` footer), and `metrics.json`:
 *
 * - `innerWidth`/`innerHeight` — the page viewport the window actually has;
 * - `sidebarFits` — the sidebar's own scroll container needs no scrolling (`scrollHeight <=
 *   clientHeight`) AND its lowest control (`#daemon-control-button`) ends inside the viewport;
 * - per Settings section, `dialogInViewport` (the dialog's box is fully inside the viewport) and
 *   `doneInViewport` (the `Done` button, the footer, is too).
 *
 * The minimum height in `window-size.ts` was chosen by running this at descending heights until one
 * of those flags turned `false` — see that file's own docstring for the numbers.
 */
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

const SETTINGS_SECTIONS = ['schedule', 'capture', 'discovery', 'terminal'] as const;

const MEASURE_SIDEBAR_SCRIPT = `
(() => {
  const sidebar = document.getElementById('sidebar');
  const lowest = document.getElementById('daemon-control-button') || document.getElementById('end-day-button');
  const scrollers = [sidebar, ...(sidebar ? sidebar.querySelectorAll('*') : [])].filter(
    (el) => el && el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible',
  );
  const bottom = lowest ? lowest.getBoundingClientRect().bottom : null;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    lowestControlBottom: bottom,
    scrollingContainers: scrollers.map((el) => el.id || el.className),
    sidebarFits: scrollers.length === 0 && bottom !== null && bottom <= window.innerHeight,
  };
})();
`;

const MEASURE_DIALOG_SCRIPT = `
(() => {
  const dialog = document.getElementById('settings-dialog');
  const done = document.getElementById('settings-dialog-done');
  const d = dialog ? dialog.getBoundingClientRect() : null;
  const b = done ? done.getBoundingClientRect() : null;
  const inside = (r) => r !== null && r.top >= 0 && r.bottom <= window.innerHeight;
  return { dialogTop: d && d.top, dialogBottom: d && d.bottom, doneBottom: b && b.bottom,
    dialogInViewport: inside(d), doneInViewport: inside(b) };
})();
`;

export async function captureWindowMinVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
  quit: () => Promise<void>,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const shoot = async (name: string): Promise<void> => {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  };
  const click = (id: string): Promise<unknown> =>
    window.webContents.executeJavaScript(`document.getElementById('${id}')?.click();`);

  await clock.sleep(2500);
  await click('daemon-ownership-transition-decline');
  await click('all-projects-link');
  await clock.sleep(600);
  await shoot('01-projects-tab.png');
  const sidebar = (await window.webContents.executeJavaScript(MEASURE_SIDEBAR_SCRIPT)) as unknown;

  await click('settings-button');
  await clock.sleep(400);
  const sections: Record<string, unknown> = {};
  for (const section of SETTINGS_SECTIONS) {
    await click(`settings-nav-${section}`);
    await clock.sleep(300);
    sections[section] = await window.webContents.executeJavaScript(MEASURE_DIALOG_SCRIPT);
    await shoot(`02-settings-${section}.png`);
  }
  await writeFile(
    path.join(outDir, 'metrics.json'),
    JSON.stringify({ sidebar, settingsSections: sections }, null, 2),
    'utf8',
  );
  await quit();
}
