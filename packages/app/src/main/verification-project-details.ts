/**
 * `SEEYA_APP_VERIFY_PROJECT_DETAILS_DIR` (V2-T83, `docs/INTERFACE.md` § 4a/§ 9): a DIRECTORY, not a
 * single file — thirteen screenshots of one window walking the whole "Project details" dialog with
 * REAL clicks on the real components (every engine action — `add-repo`, `remove-repo`,
 * `revert-adoption`, `remove` — runs for real, against a disposable workspace the driver script
 * built; none of them launches `claude`). Its own module for the same reason
 * `directory-picker-ipc.ts`/`project-details-ipc.ts` are: `main.ts` does not grow. Never read by
 * `npm run app` or the README.
 *
 * Needs, from the driver script: a disposable `SEEYA_APP_HOME_OVERRIDE` workspace with two
 * projects — "Billing ledger" (`.seeya-lock` held by a real child process, so its writes are
 * disabled) and "Payments API" (three repositories: with remote and a folder, with no remote, and
 * with a remote but no folder on this device; one adoption whose fork transcript was written to
 * after the adoption, so the "delete the copy?" question is asked) — plus
 * `SEEYA_APP_VERIFY_PICKED_DIRECTORIES` (`composition/verification-picked-directories.ts`: the
 * folders the picker "chooses", in order: a new repository, the same one again, a folder that does
 * not exist) in place of the native folder dialog, which never appears in a capture.
 *
 * Every wait polls the DOM for the thing the next step needs (never a fixed sleep guessing how
 * long a real `git` call takes): the first lock-taking action also resolves this process's own
 * `procStart` (a real `powershell.exe` on Windows, ~3s the first time).
 */
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

const WAIT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 200;
const SETTLE_MS = 500;

export async function captureProjectDetailsVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const run = (script: string): Promise<unknown> => window.webContents.executeJavaScript(script);

  async function waitUntil(condition: string): Promise<void> {
    for (let waited = 0; waited < WAIT_TIMEOUT_MS; waited += POLL_INTERVAL_MS) {
      if ((await run(`Boolean(${condition})`)) === true) {
        return;
      }
      await clock.sleep(POLL_INTERVAL_MS);
    }
  }
  async function shoot(name: string): Promise<void> {
    await clock.sleep(SETTLE_MS);
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  const click = (selector: string): Promise<unknown> =>
    run(`document.querySelector(${JSON.stringify(selector)})?.click();`);
  const idle = '!document.querySelector("#project-details-dialog [aria-busy=\\"true\\"]")';
  const dialogOpen = (id: string): string => `document.getElementById(${JSON.stringify(id)})?.open`;
  const scrollBody = (position: 'top' | 'bottom'): Promise<unknown> =>
    run(`(() => {
      const body = document.querySelector('#project-details-dialog [class*="Dialog_body"]');
      if (body) body.scrollTop = ${position === 'top' ? '0' : 'body.scrollHeight'};
    })();`);

  await clock.sleep(2500); // initial load + any ambient dialog dismissal
  await click('#all-projects-link');
  await waitUntil('document.querySelector(\'button[aria-label="Manage project Billing ledger"]\')');

  // The Projects tab itself: the `Manage project` icon button sits beside each row's main action.
  await shoot('00-projects-tab-manage-button.png');

  // V2-T77's expand button and V2-T83's Manage button, side by side on an expanded row.
  await click('button[aria-label="Show sessions of Payments API"]');
  await waitUntil(`document.querySelector('button[aria-label="Hide sessions of Payments API"]')`);
  await shoot('00b-projects-tab-row-expanded.png');
  await click('button[aria-label="Hide sessions of Payments API"]');

  // A project locked by another live session: reading works, every write is disabled with the reason.
  await click('button[aria-label="Manage project Billing ledger"]');
  await waitUntil(`document.getElementById('project-details-locked-notice')`);
  await shoot('01-locked-by-another-session.png');
  await click('#project-details-close');
  await clock.sleep(SETTLE_MS);

  // The project the rest of the walk changes.
  await click('button[aria-label="Manage project Payments API"]');
  await waitUntil(`document.querySelectorAll('#project-details-repositories li').length === 3`);
  await shoot('02-repositories.png');
  await scrollBody('bottom');
  await shoot('03-adoptions-and-remove.png');

  // Revert…: the engine plans, asks how many commits (04), then — the copy kept writing after the
  // adoption — whether to delete it too (05); Keep is the default.
  await click('#project-details-adoptions li button');
  await waitUntil(dialogOpen('revert-adoption-confirm-dialog'));
  await shoot('04-revert-confirm.png');
  await click('#revert-adoption-confirm-proceed');
  await waitUntil(dialogOpen('delete-adopted-copy-confirm-dialog'));
  await shoot('05-delete-copy-confirm.png');
  await click('#delete-adopted-copy-confirm-keep');
  await waitUntil(`document.getElementById('project-details-result') && ${idle}`);
  await scrollBody('top');
  await shoot('06-revert-result.png');

  // Add repository…: a new folder, the same folder again (already associated), a folder that
  // does not exist (a refusal with its reason).
  await click('#project-details-add-repository');
  await waitUntil(`document.getElementById('project-details-result') && ${idle}`);
  await shoot('07-add-repository-linked.png');
  await click('#project-details-add-repository');
  await waitUntil(
    `document.getElementById('project-details-result')?.textContent.includes('already associated') && ${idle}`,
  );
  await shoot('08-add-repository-already-associated.png');
  await click('#project-details-add-repository');
  await waitUntil(
    `document.getElementById('project-details-result')?.textContent.includes('does not exist') && ${idle}`,
  );
  await shoot('09-add-repository-error.png');

  // Remove on a repository row: no confirmation, the list updates at once.
  await click('#project-details-repositories li[data-repository-name="payments-notes"] button');
  await waitUntil(
    `document.getElementById('project-details-result')?.textContent.includes('Unlinked') && ${idle}`,
  );
  await shoot('10-remove-repository.png');

  // Remove project…: the confirmation (name, files, what is NOT deleted), then the readable result.
  await click('#project-details-remove-project');
  await waitUntil(dialogOpen('remove-project-confirm-dialog'));
  await shoot('11-remove-project-confirm.png');
  await click('#remove-project-confirm-proceed');
  await waitUntil(`document.getElementById('project-details-removed-title')`);
  await shoot('12-project-removed.png');
}
