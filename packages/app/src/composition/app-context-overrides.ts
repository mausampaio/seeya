/**
 * `BuildAppContextOverrides` (V2-T46, V2-T69, V2-T70, V2-T82; V2-T51: split out of
 * `composition/index.ts`, which still re-exports it) — the verification/test-only ports a caller
 * may swap before `buildAppContext` assembles the real ones.
 */
import type {
  AppInstallation,
  Autostart,
  HandoffGenerator,
  HarnessLauncher,
  SessionAdoptionLauncher,
  WorkspaceRepository,
} from '@seeya-ai/engine/core/ports.js';

/**
 * V2-T46: the two ports `buildAppContext` otherwise builds from the real, per-platform OS
 * mechanism — a Windows registry query (`AppInstallation`) and a Task Scheduler query
 * (`Autostart`), each one a fresh `powershell.exe` spawn. Measured on the machine this task
 * shipped from: the registry query costs ~400ms once "warm" but ~3s on
 * the very first `powershell.exe` spawn of a test run; the Task Scheduler query costs ~1.3-4s on
 * EVERY call, because the `ScheduledTasks` PowerShell module has to reload inside a fresh
 * `powershell.exe` process each time — there is no warm state to fall back on the way the
 * registry query has. Every real caller (`electron/main.ts`) omits both fields and gets the exact
 * same real adapters this function has always built; `tests/integration/app/composition.test.ts`
 * is the only caller that passes either, so its own assertions never depend on — or pay the cost
 * of — whatever this machine's real installation/autostart state happens to be, except in the one
 * test whose whole purpose is proving that real wiring.
 */
export interface BuildAppContextOverrides {
  readonly appInstallation?: AppInstallation;
  readonly autostart?: Autostart;
  /**
   * V2-T69: verification-only, same spirit as the two fields above — lets a screenshot script
   * exercise End day's real "em andamento"/"resultado" views (`renderer/features/end-day/`)
   * through the real `endDay()` pipeline without ever spawning a real, billed `claude -p` process.
   * `main/verification/context-overrides.ts`'s own `SEEYA_APP_VERIFY_END_DAY_FAKE` is the ONE real caller — see
   * `composition/verification-fake-generator.ts`'s own docstring for the fake implementation.
   * Every other caller (a real window) omits both and gets the real adapters, as always.
   */
  readonly leanGenerator?: HandoffGenerator;
  readonly deepGenerator?: HandoffGenerator;
  /**
   * V2-T70: same verification-only spirit as the two fields above, for the "Adopt…" flow instead
   * of End day — see `AppContext.adoptionLauncherOverride`'s own docstring.
   */
  readonly adoptionLauncher?: SessionAdoptionLauncher;
  /** V2-T82: see `AppContext.harnessLauncherOverride`. */
  readonly harnessLauncher?: HarnessLauncher;
  /**
   * V2-T70: verification-only — lets a screenshot script prove the adoption review dialog's own
   * failure result without staging a real git-hook conflict. `main/main.ts`'s own
   * `SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE` wires
   * `composition/verification-fake-failing-commit.ts#wrapWorkspaceWithFailingCommit` here. Every
   * real window omits it and gets the real `FsWorkspaceRepository` untouched.
   */
  readonly workspace?: WorkspaceRepository;
}
