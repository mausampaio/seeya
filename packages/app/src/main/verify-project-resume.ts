/**
 * V2-T77: `SEEYA_APP_VERIFY_PROJECT_RESUME_DIR` — real-window proof of `docs/INTERFACE.md` § 5a.
 * Verification-only instrumentation, same class as every other `SEEYA_APP_*` flag (never read by
 * `npm run app` or the README); its own file so `main.ts` does not grow.
 *
 * Meant to run with `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG` (V2-T82: the harness is a log writer, never
 * a real `claude`) and, for the `Go to tab` row, `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1`/
 * `SEEYA_APP_VERIFICATION_TAB_PID_PATH` (the same external-fixture mechanism V2-T67/V2-T68 use: the
 * driver script folds that tab's pid into a session record of one project).
 * `SEEYA_APP_VERIFY_PROJECT_RESUME_SESSION_IDS` is `<id>,<id>` — the full session id to `Resume`
 * from the Projects tab's expanded row, then the one to `Resume` from the Sessions tab. Real clicks
 * on the real buttons; the PROOF that each reached the harness with `--resume` is the fake harness
 * log, read by the driver afterwards — not anything this function reports.
 *
 * Files, in order: `01-projects-expanded.png` (every row expanded: the `Go to tab` session, the
 * `Resume` ones), `02-projects-after-resume.png` (right after the Projects-tab `Resume`: the
 * result notice), `03-sessions-tab.png` (project sessions with `Resume` alone), `04-sessions-after-
 * resume.png` (right after the Sessions-tab `Resume`), `05-show-all-in-sessions.png` (the Projects
 * tab's `Show all ... in Sessions`, landing on Sessions already filtered to that project).
 */
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

export async function captureProjectResumeVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
  sessionIds: string,
  quit: () => Promise<void>,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const [projectsTabSessionId, sessionsTabSessionId] = sessionIds.split(',');
  const shoot = async (name: string): Promise<void> => {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  };
  const run = (script: string): Promise<unknown> => window.webContents.executeJavaScript(script);
  const click = (id: string): Promise<unknown> => run(`document.getElementById('${id}')?.click();`);

  await clock.sleep(1500); // after SEEYA_APP_AUTO_OPEN_SHELL_TAB's own tab has opened
  await click('daemon-ownership-transition-decline');
  await click('all-projects-link');
  // The driver reads the tab pid, writes the session record and waits for one ambient refresh tick
  // (`REFRESH_INTERVAL_MS`, 10s) — the same budget `captureProjectsTabStatesVerification` uses.
  await clock.sleep(33000);
  // The shell tab `SEEYA_APP_AUTO_OPEN_SHELL_TAB` opens takes the focus when its pty finishes
  // spawning, which can land after the first click above — focus Projects again, now that
  // everything has settled.
  await click('all-projects-link');
  await clock.sleep(400);
  await run(
    `document.querySelectorAll('button[aria-label^="Show sessions of"]').forEach((b) => b.click());`,
  );
  await clock.sleep(400);
  await shoot('01-projects-expanded.png');

  await run(
    `document.querySelector('[data-resume-session-id="${projectsTabSessionId ?? ''}"] button')?.click();`,
  );
  await clock.sleep(6000);
  await shoot('02-projects-after-resume.png');

  await click('sessions-link');
  await clock.sleep(500);
  await shoot('03-sessions-tab.png');
  await run(`
    (() => {
      const id = ${JSON.stringify(sessionsTabSessionId ?? '')};
      const row = document.querySelector('[data-session-id="' + id + '"]')?.closest('tr');
      [...(row ? row.querySelectorAll('button') : [])].find((b) => b.textContent === 'Resume')?.click();
    })();
  `);
  await clock.sleep(6000);
  await shoot('04-sessions-after-resume.png');

  await click('all-projects-link');
  await clock.sleep(500);
  await run(
    `[...document.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Show all'))?.click();`,
  );
  await clock.sleep(600);
  await shoot('05-show-all-in-sessions.png');
  await quit();
}
