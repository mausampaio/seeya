/**
 * The `SEEYA_APP_*` flags that swap a real adapter for a fake while `buildAppContext` assembles the
 * window's context (V2-T51: moved out of `main/main.ts`'s `app.whenReady()` handler). With none of
 * them set the result is `{}`, so `buildAppContext` assembles exactly the real context.
 */
import type { AppInstallation } from '@seeya-ai/engine/core/ports.js';
import { systemClock } from '@seeya-ai/engine/adapters/clock/index.js';
import { type BuildAppContextOverrides } from '../../composition/index.js';
import { VerificationFakeHandoffGenerator } from '../../composition/verification-fake-generator.js';
import { VerificationFakeAdoptionLauncher } from '../../composition/verification-fake-adoption-launcher.js';
import { VerificationFakeHarnessLauncher } from '../../composition/verification-fake-harness-launcher.js';
import { wrapWorkspaceWithFailingCommit } from '../../composition/verification-fake-failing-commit.js';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';

/** `SEEYA_APP_VERIFY_END_DAY_FAKE`'s own per-session artificial delay (V2-T69) — see that flag's
 * own comment, where `contextOverrides` is built, and the click-automation block below for the
 * full timing this buys a mid-flight "progress" screenshot. */
const END_DAY_FAKE_DELAY_MS = 2000;

/** `SEEYA_APP_VERIFY_ADOPTION_FAKE`'s own artificial delay (V2-T70) — long enough for a
 * screenshot taken right after clicking "Open the copy" to still show the dialog closed/the tab
 * in flight, short enough that the automation block driving this doesn't need its own long wait. */
const ADOPTION_FAKE_DELAY_MS = 300;

export function buildVerificationContextOverrides(): BuildAppContextOverrides {
  // SEEYA_APP_VERIFY_END_DAY_FAKE (V2-T69): 'preview' | 'progress' | 'result' | 'hidden' — picks
  // which of End day's own views (`renderer/features/end-day/`) the click-automation block below
  // drives the window to before `captureVerificationScreenshot` fires. Whenever set at all, BOTH
  // generators become `VerificationFakeHandoffGenerator` (`composition/verification-fake-
  // generator.ts`) — a real, billed `claude -p` must never run just because someone wanted a
  // screenshot of the progress/result view. `END_DAY_FAKE_DELAY_MS` is what spaces sessions out
  // enough for a mid-flight screenshot to show one `captured`, one `capturing`, one `waiting`
  // (see the click-automation block's own comment for the exact timing this buys). Never set by
  // `npm run app` or the README.
  const endDayFakeScenario = process.env.SEEYA_APP_VERIFY_END_DAY_FAKE;
  // SEEYA_APP_VERIFY_FAKE_INSTALLED_LAUNCH_PATH (V2-T71): `captureDaemonOwnershipTransitionVerification`'s
  // own driver — a fake `AppInstallation` that reports "installed" at the given path WITHOUT
  // ever querying the real OS registry/`dpkg`/`/Applications` (`BuildAppContextOverrides
  // .appInstallation`'s own docstring already names this exact use). Never set by `npm run app`
  // or the README.
  const fakeInstalledLaunchPath = process.env.SEEYA_APP_VERIFY_FAKE_INSTALLED_LAUNCH_PATH;
  const fakeAppInstallation: AppInstallation | undefined =
    fakeInstalledLaunchPath === undefined
      ? undefined
      : {
          find: () =>
            Promise.resolve({ kind: 'installed', executablePath: fakeInstalledLaunchPath }),
        };
  // SEEYA_APP_VERIFY_ADOPTION_FAKE (V2-T70): whenever set at all (any value), the real
  // `ProjectAdoptTabLauncher` is replaced by `VerificationFakeAdoptionLauncher` — a real
  // `claude` adoption fork must never launch just because someone wanted a screenshot of the
  // review-before-commit step (`renderer/features/adoption/`). Never set by `npm run app` or
  // the README.
  const adoptionFakeRequested = process.env.SEEYA_APP_VERIFY_ADOPTION_FAKE !== undefined;
  // SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE (V2-T70): proves the adoption review dialog's
  // own failure result (`docs/INTERFACE.md` § 7 item 3) — `wrapWorkspaceWithFailingCommit`'s own
  // docstring explains why a thrown `commitAll` stands in for a real git-hook refusal. Only ever
  // meaningful alongside `SEEYA_APP_VERIFY_ADOPTION_FAKE` (there is no commit to fail without a
  // fork that wrote something first). Never set by `npm run app` or the README.
  const adoptionCommitFailureRequested =
    process.env.SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE !== undefined;
  const contextOverrides: BuildAppContextOverrides = {
    ...(endDayFakeScenario !== undefined
      ? {
          leanGenerator: new VerificationFakeHandoffGenerator(systemClock, END_DAY_FAKE_DELAY_MS),
          deepGenerator: new VerificationFakeHandoffGenerator(systemClock, END_DAY_FAKE_DELAY_MS),
        }
      : {}),
    ...(fakeAppInstallation !== undefined ? { appInstallation: fakeAppInstallation } : {}),
    ...(adoptionFakeRequested
      ? {
          adoptionLauncher: new VerificationFakeAdoptionLauncher(
            systemClock,
            ADOPTION_FAKE_DELAY_MS,
          ),
        }
      : {}),
    // SEEYA_APP_VERIFY_FAKE_HARNESS_LOG (V2-T82): the path of a file that
    // `VerificationFakeHarnessLauncher` appends one line to per `openProject` call, instead of
    // spawning `claude`. Never set by `npm run app` or the README.
    ...(process.env.SEEYA_APP_VERIFY_FAKE_HARNESS_LOG !== undefined
      ? {
          harnessLauncher: new VerificationFakeHarnessLauncher(
            process.env.SEEYA_APP_VERIFY_FAKE_HARNESS_LOG,
          ),
        }
      : {}),
    ...(adoptionCommitFailureRequested
      ? {
          workspace: wrapWorkspaceWithFailingCommit(
            new FsWorkspaceRepository(),
            'seeya: verification fixture — commitAll always fails under ' +
              'SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE.',
          ),
        }
      : {}),
  };
  return contextOverrides;
}
