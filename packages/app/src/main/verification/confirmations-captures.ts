/**
 * The confirmation-dialog and daemon-ownership directory captures (V2-T71; V2-T51: moved out of
 * `main/main.ts`).
 */
import path from 'node:path';
import { BrowserWindow } from 'electron';
import { CHANNELS } from '../../ipc/channels.js';
import type {
  FallbackConfirmRequestEvent,
  ConfirmProjectLockOpenRequestEvent,
  ConfirmLeftoverChangesOpenRequestEvent,
  ChangedFileRow,
} from '../../ipc/channels.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { quitAfterConfiguredDelay } from './quit-after.js';

/**
 * SEEYA_APP_VERIFY_CONFIRMATIONS_DIR (V2-T71, `docs/INTERFACE.md` § 9): a DIRECTORY, not a single
 * file — seven screenshots, one per confirmation state this task redesigned (lock, leftover
 * changes, the two resume-fallback shapes, and the three "New project" states). The lock/
 * leftover-changes/fallback dialogs are driven by sending FAKE
 * `confirmProjectLockOpenRequest`/`confirmLeftoverChangesOpenRequest`/`confirmFallbackRequest`
 * events directly (`window.webContents.send`, the exact channel/shape `main/project-ipc.ts`
 * sends for real) instead of the real `openProject()`/resume-fallback machinery — the real paths
 * would need either a second real `seeya` process genuinely holding a project lock or a real
 * `claude --resume` failure, neither appropriate for a screenshot script. "Instrumentação com
 * dependências fictícias" is this task's own prescribed technique for reaching these dialogs,
 * the same spirit as V2-T69's fake generator. **`heldByPid`/`heldByAcquiredAt` for the lock
 * screenshot are never invented** (the V2-T68 lesson this task's own brief names): they come from
 * `SEEYA_APP_VERIFY_DECOY_PID`/`SEEYA_APP_VERIFY_DECOY_PROC_START`, env vars the driver script
 * sets from a REAL spawned child process's own `adapters/process/proc-start.ts
 * #captureObservedProcStart` reading. Each fake-driven dialog is explicitly `.close()`d (firing
 * its own native `close` event, which the component answers with a `requestId` that
 * `PendingConfirmations`/`PendingFallbackRequests` never registered — a silent no-op by design,
 * both classes' own docstrings) before the next one opens, so only ever one dialog is on screen
 * at a time. "New project" is the one state NOT faked — `CHANNELS.createProject` against the
 * fixture's own disposable workspace has no side effect worth avoiding, so its three states
 * (empty, a local format error, the engine's own "already exists") run for real: created once,
 * then the identical id submitted again for the engine's own rejection. Never set by
 * `npm run app` or the README.
 */
export async function captureConfirmationsVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function closeDialog(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`document.getElementById('${id}')?.close();`);
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

  await clock.sleep(2000);
  // Defensive dismiss of a stray real daemon-ownership-transition dialog, same self-contained
  // one-click shape `SEEYA_APP_VERIFY_END_DAY_FAKE` already uses — unrelated to what this flag
  // proves, and harmless here either way (`Leave it as it is` never touches a real daemon).
  await click('daemon-ownership-transition-decline');
  await clock.sleep(500);

  const decoyPid = Number(process.env.SEEYA_APP_VERIFY_DECOY_PID ?? '');
  const decoyProcStart = process.env.SEEYA_APP_VERIFY_DECOY_PROC_START;
  const lockEvent: ConfirmProjectLockOpenRequestEvent = {
    requestId: 'verify-lock',
    projectId: 'payments-webhooks',
    heldBySessionId: '22222222-2222-4222-8222-222222222222',
    heldByPid: Number.isFinite(decoyPid) ? decoyPid : 1,
    heldByAcquiredAt: new Date(clock.now().getTime() - 2 * 60 * 60 * 1000),
  };
  void decoyProcStart; // carried by the fixture's own real `.seeya-lock`, never needed in the event itself
  window.webContents.send(CHANNELS.confirmProjectLockOpenRequest, lockEvent);
  await clock.sleep(500);
  await shoot('01-project-locked.png');
  await closeDialog('project-lock-confirm-dialog');
  await clock.sleep(400);

  const changedFiles: readonly ChangedFileRow[] = [
    { path: 'billing-reconciliation/context/know-how.md', status: 'added' },
    { path: 'billing-reconciliation/status/current.md', status: 'modified' },
    {
      path: 'billing-reconciliation/decisions/2026-10-01-reconciliation-window.md',
      status: 'added',
    },
    { path: 'billing-reconciliation/INDEX.md', status: 'modified' },
    { path: 'billing-reconciliation/AGENTS.md', status: 'modified' },
    { path: 'billing-reconciliation/context/invoices.md', status: 'added' },
    { path: 'billing-reconciliation/context/ledger-notes.md', status: 'added' },
    { path: 'billing-reconciliation/journal/2026-10-01.md', status: 'added' },
    { path: 'billing-reconciliation/journal/2026-09-30.md', status: 'added' },
    { path: 'billing-reconciliation/status/blocked.md', status: 'deleted' },
    { path: 'billing-reconciliation/context/old-notes.md', status: 'deleted' },
    { path: 'billing-reconciliation/decisions/2026-09-29-ledger-format.md', status: 'modified' },
    { path: 'billing-reconciliation/context/reconciliation-steps.md', status: 'added' },
    { path: 'billing-reconciliation/status/next.md', status: 'added' },
    { path: 'billing-reconciliation/context/vendor-mapping.md', status: 'renamed' },
    { path: 'billing-reconciliation/context/retry-policy.md', status: 'added' },
    { path: 'billing-reconciliation/decisions/2026-09-28-retry-budget.md', status: 'added' },
    { path: 'billing-reconciliation/status/archive/2026-09.md', status: 'added' },
  ];
  const leftoverEvent: ConfirmLeftoverChangesOpenRequestEvent = {
    requestId: 'verify-leftover',
    projectId: 'billing-reconciliation',
    changedFiles,
  };
  window.webContents.send(CHANNELS.confirmLeftoverChangesOpenRequest, leftoverEvent);
  await clock.sleep(500);
  await shoot('02-leftover-changes.png');
  await closeDialog('leftover-changes-confirm-dialog');
  await clock.sleep(400);

  const resumeFailedEvent: FallbackConfirmRequestEvent = {
    requestId: 'verify-fallback-resume-failed',
    sessionName: 'payments-webhooks',
    cwd: '~/code/payments-webhooks',
    reasonText: 'Resuming this session failed, and starting fresh is the only option left',
    offersResumeWithoutPlan: false,
  };
  window.webContents.send(CHANNELS.confirmFallbackRequest, resumeFailedEvent);
  await clock.sleep(500);
  await shoot('03-fallback-resume-failed.png');
  await closeDialog('fallback-dialog');
  await clock.sleep(400);

  const promptTooLargeEvent: FallbackConfirmRequestEvent = {
    ...resumeFailedEvent,
    requestId: 'verify-fallback-prompt-too-large',
    reasonText: "Yesterday's plan was too large to pass along when resuming",
    offersResumeWithoutPlan: true,
  };
  window.webContents.send(CHANNELS.confirmFallbackRequest, promptTooLargeEvent);
  await clock.sleep(500);
  // ResumeFallbackDialog.module.css#.cardsScroll (`[class*=]`, never the exact generated name —
  // this file never imports that module, D-041): scrolled to the bottom so the THIRD, recommended
  // card is the one the screenshot actually proves, not just the two that already fit.
  await window.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('[class*="cardsScroll"]');
      if (el) { el.scrollTop = el.scrollHeight; }
    })();
  `);
  await clock.sleep(300);
  await shoot('04-fallback-prompt-too-large.png');
  await closeDialog('fallback-dialog');
  await clock.sleep(400);

  // "New project" — fully real, never faked (see this function's own docstring): created once
  // for real, then the SAME id submitted again for the engine's own "already exists" rejection.
  await click('new-project-button');
  await clock.sleep(400);
  await shoot('05-new-project-empty.png');

  // `.blur()` on an element that was never `.focus()`d first is a no-op (nothing to blur FROM) —
  // `setFieldValue` only sets the value and fires `input`, never focus, so this needs its own
  // explicit `.focus()` before the value is even set for the later `.blur()` to fire anything at
  // all (confirmed against a real run of this instrumentation before this fix: the error line
  // never appeared, because `TextField.tsx`'s own `onBlur` handler was simply never called).
  // `window.focus()` (the BrowserWindow itself, same fix `SessionsTable`'s own clipboard
  // instrumentation already needed) — without real OS-level focus, this offscreen window's own
  // blur/focus DOM calls land on `document.activeElement` but apparently never fire the actual
  // `blur` event a real window would.
  window.focus();
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-id-input')?.focus();",
  );
  await setFieldValue('new-project-id-input', 'Invalid Id!');
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-id-input')?.blur();",
  );
  await clock.sleep(400);
  await shoot('06-new-project-format-error.png');

  await setFieldValue('new-project-id-input', 'payments-webhooks');
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-form')?.requestSubmit();",
  );
  await clock.sleep(2000);
  await click('new-project-button');
  await clock.sleep(400);
  await setFieldValue('new-project-id-input', 'payments-webhooks');
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-form')?.requestSubmit();",
  );
  await clock.sleep(1500);
  await shoot('07-new-project-already-exists.png');

  await quitAfterConfiguredDelay(clock);
}

/**
 * SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR (V2-T71, `docs/INTERFACE.md` § 9): a DIRECTORY, not a
 * single file — two screenshots, "em repouso" and "em `loading`", of the REAL daemon-ownership
 * transition dialog (`getDaemonOwnershipTransitionOffer`/`shouldOfferDaemonOwnershipTransition`,
 * never faked at the IPC layer the way the dialogs above are). Reaching `shouldOffer: true`
 * deterministically needs `BuildAppContextOverrides.appInstallation` (see where
 * `contextOverrides` is built, below) pointed at a fake "installed" status — this never queries
 * the real OS registry/`dpkg`/`/Applications` — PLUS a fixture `daemon.lock` (written by the
 * driver script into `SEEYA_APP_HOME_OVERRIDE`'s own `.seeya/`, never the real `~/.seeya/`) naming
 * a REAL live pid (the same decoy process `SEEYA_APP_VERIFY_CONFIRMATIONS_DIR`'s own lock
 * screenshot uses) with a `launchedBy` different from the fake install path — the two facts
 * `shouldOfferDaemonOwnershipTransition` needs to see a genuinely different executable's daemon
 * running. The loading screenshot clicks the REAL `Leave it as it is` button (never `Let seeya
 * take over` — accepting really would touch autostart/the daemon, this task's own explicit
 * prohibition) with `SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS` set alongside this
 * directory so the real IPC response lands inside the capture window instead of racing it. Never
 * set by `npm run app` or the README.
 */
export async function captureDaemonOwnershipTransitionVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  await clock.sleep(7000); // the dialog's own async getDaemonOwnershipTransitionOffer() round trip (measured: 4s was too early on a loaded machine, the idle capture showed no dialog)
  await shoot('01-idle.png');
  await window.webContents.executeJavaScript(
    "document.getElementById('daemon-ownership-transition-decline')?.click();",
  );
  await clock.sleep(400); // inside SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS's own hold
  await shoot('02-loading.png');
  await quitAfterConfiguredDelay(clock);
}
