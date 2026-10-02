/**
 * V2-T82 — a `HarnessLauncher` that never spawns `claude`: it appends one JSON line per `open()`
 * call to a log file, so a verification run can prove (from a file written by the REAL
 * `openProject` pipeline, not by the renderer) whether a click on the adoption result's **Close**
 * or **Open project** button reached the harness at all.
 *
 * **Only ever wired by `main/main.ts`'s own `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG`**, via
 * `BuildAppContextOverrides.harnessLauncher` — every real window omits it and gets the real
 * `ProjectOpenTabLauncher`.
 */
import { appendFile } from 'node:fs/promises';
import type { HarnessLauncher, HarnessOpenResult } from '@seeya-ai/engine/core/ports.js';

export class VerificationFakeHarnessLauncher implements HarnessLauncher {
  constructor(private readonly logPath: string) {}

  async open(
    cwd: string,
    addDirs: readonly string[],
    sessionId: string,
    systemPromptAppend: string | null,
  ): Promise<HarnessOpenResult> {
    void addDirs;
    void systemPromptAppend;
    await appendFile(this.logPath, `${JSON.stringify({ opened: cwd, sessionId })}\n`, 'utf8');
    return { kind: 'opened', exitCode: 0 };
  }
}
