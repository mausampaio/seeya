/**
 * V2-T70 — a `SessionAdoptionLauncher` that never spawns `claude` at all, for the one screenshot
 * script this task's own prova visual requires: the "Adopt…" flow's step 2 (review files before
 * commit, `renderer/features/adoption/`) can only be reached once a real fork session has closed
 * and left something uncommitted inside the project — but the person asking for this screenshot
 * never adopted a real session, so no real harness should ever launch (`docs/FLUXO-DE-AGENTES.md`'s
 * own warning against a REAL window spawning a REAL `claude`).
 *
 * **Only ever wired by `main/main.ts`'s own `SEEYA_APP_VERIFY_ADOPTION_FAKE`**, via
 * `BuildAppContextOverrides.adoptionLauncher` (`composition/index.ts`) — every real window omits
 * it and gets the real `ProjectAdoptTabLauncher`. Writes a small, clearly-labeled fixture file
 * into `projectDir` (never outside it — the same "escreve apenas dentro do projeto que o próprio
 * fluxo autorizaria" a real adopted session would do) so `finishAdoption`'s own
 * `listChangedFilesWithStats` has something real to report, proving the review dialog renders
 * actual git-derived type/line data, not a second fixture duplicating that shape.
 *
 * **`delayMs` via `clock.sleep` (D-019), never a raw `setTimeout`** — same discipline
 * `verification-fake-generator.ts`'s own docstring already states for this exact category of
 * verification-only code.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  Clock,
  HarnessOpenResult,
  SessionAdoptionLauncher,
} from '@seeya-ai/engine/core/ports.js';

export class VerificationFakeAdoptionLauncher implements SessionAdoptionLauncher {
  constructor(
    private readonly clock: Clock,
    private readonly delayMs: number,
  ) {}

  async adopt(
    originalCwd: string,
    projectDir: string,
    originalSessionId: string,
    forkSessionId: string,
  ): Promise<HarnessOpenResult> {
    void originalCwd;
    void originalSessionId;
    await this.clock.sleep(this.delayMs);
    const contextDir = path.join(projectDir, 'context');
    await mkdir(contextDir, { recursive: true });
    await writeFile(
      path.join(contextDir, 'know-how.md'),
      '(Verification fixture, V2-T70 — never a real adopted session.)\n' +
        `Fork ${forkSessionId} would have carried over its own tools and setup notes here.\n` +
        'This line exists only to prove the review dialog renders a real git diff.\n',
      'utf8',
    );
    // Appends to whatever `INDEX.md` the real `ensureProjectExists`/`buildProjectSkeleton` already
    // wrote for this project's own id — never a hardcoded id, so the review dialog's own "modified"
    // entry is a genuine diff against real content, regardless of which project this fixture ran
    // against.
    const indexPath = path.join(projectDir, 'INDEX.md');
    const existingIndex = await readFile(indexPath, 'utf8');
    await writeFile(
      indexPath,
      `${existingIndex}\n(Verification fixture, V2-T70 — appended by the fake fork, never a real session.)\n`,
      'utf8',
    );
    // Also removes the skeleton's own `AGENTS.md` (a real, tracked file every project starts
    // with) so the review dialog has a real `deleted` entry to show too, not just added/modified —
    // `docs/INTERFACE.md` § 7 item 2's own "tipo (M/A, e D se existir)". Harmless here: this
    // project only ever exists inside a disposable `SEEYA_APP_HOME_OVERRIDE` workspace, never a
    // real one, and the fork is discarded/committed from this call's own fixture regardless.
    await rm(path.join(projectDir, 'AGENTS.md'), { force: true });
    return { kind: 'opened', exitCode: 0 };
  }
}
