/**
 * `SEEYA_APP_QUIT_AFTER_MS` (verification only, V2-T51: moved out of `main/main.ts` together with
 * every other `SEEYA_APP_*` flag — `main/verification/index.ts` is the single entry production
 * code imports from). Shared by every capture function in this folder.
 */
import { app } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

/**
 * V2-T66 bug fix: every `captureXVerification` function below used to compute
 * `Number(process.env.SEEYA_APP_QUIT_AFTER_MS ?? '')` and check `Number.isFinite(...)` inline —
 * `Number('')` is `0` in JavaScript, not `NaN`, so leaving the variable UNSET (every normal run,
 * and every verification run that only wants a screenshot while the window stays open) was
 * silently read as "quit after 0ms", quitting the app the instant the LAST capture finished
 * regardless of intent. Found while chasing a real defect in this task's own two-screenshot
 * capture (`captureResumeProgressThenResult`): the app quit before its own SECOND capture ever
 * ran. Fixed once, here, shared by every capture function — `undefined`/unset now genuinely means
 * "never quit on its own", matching what every one of these functions' own docstrings already
 * claimed.
 */
export async function quitAfterConfiguredDelay(clock: Clock): Promise<void> {
  const raw = process.env.SEEYA_APP_QUIT_AFTER_MS;
  if (raw === undefined) {
    return;
  }
  const quitAfterMs = Number(raw);
  if (Number.isFinite(quitAfterMs)) {
    await clock.sleep(quitAfterMs);
    app.quit();
  }
}
