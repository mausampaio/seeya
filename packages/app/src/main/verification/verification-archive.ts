/**
 * `SEEYA_APP_VERIFY_ARCHIVE_DIR` (V2-T84, `docs/INTERFACE.md` § 4b/§ 9): a DIRECTORY, not a single
 * file — the screenshots of one window walking the whole archive feature with REAL clicks on the
 * real components. Archiving and unarchiving run for real, against a disposable workspace the
 * driver script built (real git, the workspace's own commit-msg hook); `Unarchive and open` goes
 * through the real `openProject` pipeline into `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG`'s fake harness
 * (the proof it reached the harness is that log, read by the driver — never `claude`). Its own
 * module for the same reason `verification-project-details.ts` is: `main.ts` does not grow. Never
 * read by `npm run app` or the README.
 *
 * Needs, from the driver script: a disposable `SEEYA_APP_HOME_OVERRIDE` whose workspace holds
 * "Payments API" (active, favorite, with a session), "Billing ledger" (active, `.seeya-lock` held
 * by a real child process, so its row reads `Locked by session <id>`), "Web portal" (active),
 * "Old thing" (archived with a note, favorite, with a session) and "Legacy tool" (archived, no
 * note); `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG`; the theme in the home's `config.json`.
 *
 * Files, in order: `01-projects-all.png` (only the active projects; the lateral has no "Old thing"
 * although it is a favorite), `02-projects-archived.png`, `03-sessions-archived-resume-off.png`,
 * `04-unarchive-confirm.png`, `05-details-archived.png`, `06-details-active-archive-section.png`,
 * `07-archive-confirm-with-note.png`, `08-details-after-archive.png`, `09-projects-all-after-
 * archive.png` (Payments API gone from the list and from Favorites), `10-projects-archived-after.png`,
 * `11-unarchive-and-open-result.png` (back in the list and in Favorites: the star was never
 * touched), and `metrics.json` — the geometry of every truncatable text in the Projects table at the
 * window's own 1200px width (a text whose `scrollWidth` exceeds its `clientWidth` is cut), plus the
 * disabled-`Resume` tooltip and the disabled/enabled facts a screenshot cannot show.
 */
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

const WAIT_TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 200;
const SETTLE_MS = 600;

const MEASURE_TRUNCATION_SCRIPT = `
(() => {
  const cut = [];
  const all = [];
  for (const el of document.querySelectorAll('table td span, table td div')) {
    if (el.children.length > 0) continue;
    const text = (el.textContent || '').trim();
    if (text === '') continue;
    const record = { text, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
      width: Math.round(el.getBoundingClientRect().width), title: el.getAttribute('title') };
    all.push(record);
    if (el.scrollWidth > el.clientWidth + 1) cut.push(record);
  }
  const lock = all.find((r) => r.text.startsWith('Locked'));
  return { innerWidth: window.innerWidth, lockCell: lock || null, truncated: cut };
})();
`;

export async function captureArchiveVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
  quit: () => Promise<void>,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const run = (script: string): Promise<unknown> => window.webContents.executeJavaScript(script);
  const metrics: Record<string, unknown> = {};

  async function waitUntil(condition: string): Promise<boolean> {
    for (let waited = 0; waited < WAIT_TIMEOUT_MS; waited += POLL_INTERVAL_MS) {
      if ((await run(`Boolean(${condition})`)) === true) {
        return true;
      }
      await clock.sleep(POLL_INTERVAL_MS);
    }
    return false;
  }
  async function shoot(name: string): Promise<void> {
    await clock.sleep(SETTLE_MS);
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  const click = (selector: string): Promise<unknown> =>
    run(`document.querySelector(${JSON.stringify(selector)})?.click();`);
  /** Clicks the first button with exactly `label` inside the table row whose text has `rowText`. */
  const clickRowButton = (rowText: string, label: string): Promise<unknown> =>
    run(`(() => {
      const row = [...document.querySelectorAll('tr')].find((tr) => tr.textContent.includes(${JSON.stringify(rowText)}));
      [...(row ? row.querySelectorAll('button') : [])].find((b) => b.textContent.trim() === ${JSON.stringify(label)})?.click();
    })();`);
  const rowHas = (rowText: string): string =>
    `[...document.querySelectorAll('tr')].some((tr) => tr.textContent.includes(${JSON.stringify(rowText)}))`;
  const dialogOpen = (id: string): string => `document.getElementById(${JSON.stringify(id)})?.open`;
  const dialogClosed = (id: string): string =>
    `!document.getElementById(${JSON.stringify(id)})?.open`;

  await clock.sleep(2500);
  await click('#daemon-ownership-transition-decline');
  await click('#all-projects-link');
  await waitUntil(rowHas('Payments API'));
  // The Projects tab at the window's own width (1200px): every truncatable text measured.
  metrics['projectsAllTruncation'] = await run(MEASURE_TRUNCATION_SCRIPT);
  await shoot('01-projects-all.png');

  await click('#projects-filter-archived');
  await waitUntil(rowHas('Old thing'));
  metrics['projectsArchivedTruncation'] = await run(MEASURE_TRUNCATION_SCRIPT);
  await shoot('02-projects-archived.png');

  // The Sessions tab: the archived project's session stays listed with the project name, Resume off.
  await click('#sessions-link');
  await waitUntil(rowHas('Old thing'));
  metrics['sessionsArchivedResume'] = await run(`(() => {
    const buttons = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Resume');
    return buttons.map((b) => ({ disabled: b.disabled, title: b.getAttribute('title') }));
  })();`);
  await shoot('03-sessions-archived-resume-off.png');

  // `Unarchive…` on an archived row: the question with both outcomes explained (never clicked here).
  await click('#all-projects-link');
  await click('#projects-filter-archived');
  await waitUntil(rowHas('Legacy tool'));
  await clickRowButton('Legacy tool', 'Unarchive…');
  await waitUntil(dialogOpen('unarchive-project-confirm-dialog'));
  await shoot('04-unarchive-confirm.png');
  await click('#unarchive-project-confirm-decline');
  await waitUntil(dialogClosed('unarchive-project-confirm-dialog'));

  // Project details of an ARCHIVED project: the state (date and note) and Unarchive.
  await click('button[aria-label="Manage project Old thing"]');
  await waitUntil(`document.getElementById('project-details-archived-state')`);
  await shoot('05-details-archived.png');
  await click('#project-details-close');
  await waitUntil(dialogClosed('project-details-dialog'));

  // Project details of an ACTIVE project: Archive project… above Remove project.
  await click('#projects-filter-all');
  await waitUntil(rowHas('Payments API'));
  await click('button[aria-label="Manage project Payments API"]');
  await waitUntil(`document.getElementById('project-details-archive-project')`);
  await run(`(() => {
    const body = document.querySelector('#project-details-dialog [class*="Dialog_body"]');
    if (body) body.scrollTop = body.scrollHeight;
  })();`);
  await shoot('06-details-active-archive-section.png');

  // Archive project… → the confirmation with a note typed.
  await click('#project-details-archive-project');
  await waitUntil(dialogOpen('archive-project-confirm-dialog'));
  await run(`(() => {
    const el = document.getElementById('archive-project-note-input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, 'Finished — shipped to production');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })();`);
  await clock.sleep(300);
  await shoot('07-archive-confirm-with-note.png');
  // Archive for real: the lock is taken, the manifest written, the commit goes through the hook.
  await click('#archive-project-confirm-proceed');
  const archived = await waitUntil(
    `${dialogClosed('archive-project-confirm-dialog')} && document.getElementById('project-details-archived-state')`,
  );
  metrics['archiveRanForReal'] = archived;
  await shoot('08-details-after-archive.png');
  await click('#project-details-close');
  await waitUntil(dialogClosed('project-details-dialog'));

  // The list and the lateral without the project just archived (it was a favorite).
  await click('#projects-filter-all');
  await waitUntil(`!(${rowHas('Payments API')})`);
  await shoot('09-projects-all-after-archive.png');
  await click('#projects-filter-archived');
  await waitUntil(rowHas('Payments API'));
  await shoot('10-projects-archived-after.png');

  // Reference run of the SAME `openProject` IPC the dialog's `Unarchive and open` chains into, on a
  // never-archived project: records its own outcome text, so a missing harness-log line for the
  // archived-then-opened project can be told apart from an `open` that cannot run at all here.
  metrics['openNeverArchivedProject'] = await run(
    `window.seeya.openProject({ projectId: 'web-portal' }).then((r) => r.outcomeText, (e) => 'rejected: ' + String(e))`,
  );

  // Unarchive and open: the real unarchive, then the real `openProject` into the fake harness.
  await clickRowButton('Payments API', 'Unarchive…');
  await waitUntil(dialogOpen('unarchive-project-confirm-dialog'));
  await click('#unarchive-project-confirm-open');
  await waitUntil(dialogClosed('unarchive-project-confirm-dialog'));
  // Give `openProject` (hooks, CLAUDE.md, audit, the fake harness) time to run; the proof is the
  // harness log the driver reads, not this wait.
  await clock.sleep(10_000);
  await click('#projects-filter-all');
  await waitUntil(rowHas('Payments API'));
  await shoot('11-unarchive-and-open-result.png');

  await writeFile(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
  await quit();
}
