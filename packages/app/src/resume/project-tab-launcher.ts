/**
 * `HarnessLauncher`/`SessionAdoptionLauncher` (`@seeya-ai/engine/core/ports.js`) implemented over a
 * tab instead of the CLI's inherited terminal (V2-T30 item 3) — the same move V2-T4 already made
 * for `SessionResumer` (`tab-session-resumer.ts`). Reuses that file's own `TabResumeOpener`
 * interface rather than declaring a second, structurally identical one: the real implementation
 * (`electron/main.ts`'s own `tabResumeOpener`) already does exactly what this needs — open a tab and
 * learn about its exit — regardless of whether the tab came from a resume, an `open`, or an
 * `adopt`.
 *
 * **Unlike `TabSessionResumer`, this DOES wait for the tab to exit** — `HarnessLauncher.open`'s own
 * contract (`core/ports.ts`) is "resolves once the harness closes, with its exit code", because
 * `application/project-open.ts#openProject` uses that exit to release the project lock and read its
 * final status right after. What makes the WINDOW itself non-blocking (Q-087 item 3's own "o `open`
 * deixa de bloquear") is that `electron/main.ts` never awaits the whole `openProject`/`adoptSession`
 * call before answering the renderer's own IPC request — it kicks that call off in the background
 * and reports back over a push event once it resolves, same "the app never waits on a session"
 * shape `TabSessionResumer`'s own module comment already establishes for a different port.
 */
import type {
  HarnessLauncher,
  HarnessOpenResult,
  SessionAdoptionLauncher,
} from '@seeya-ai/engine/core/ports.js';
import { buildOpenArgs } from '@seeya-ai/engine/adapters/harness/args.js';
import { buildAdoptArgs } from '@seeya-ai/engine/adapters/harness/adopt-args.js';
import type { TabResumeOpener } from './tab-session-resumer.js';

/** Opens a tab and resolves once it exits, mapping a spawn failure (e.g. `claude` not found on
 * `PATH` — `electron/main.ts#resolveHarnessOrThrow`'s own thrown error) onto `failedToStart` rather
 * than letting it reject the caller's own `HarnessLauncher.open`/`SessionAdoptionLauncher.adopt`
 * promise — `openProject`/`adoptSession` both expect this port to resolve, never throw. */
async function openTabAndAwaitExit(
  opener: TabResumeOpener,
  tabRequest: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
  },
): Promise<HarnessOpenResult> {
  try {
    const tab = await opener.openTab(tabRequest);
    return await new Promise<HarnessOpenResult>((resolve) => {
      opener.onceExit(tab.id, (exitCode) => resolve({ kind: 'opened', exitCode }));
    });
  } catch {
    return { kind: 'failedToStart' };
  }
}

export interface ProjectOpenTabLauncherOptions {
  readonly claudeCommand: string;
  readonly opener: TabResumeOpener;
  /** The tab's own label (item 3: "a aba leva o nome do projeto") — the project's display name,
   * resolved once by the caller before constructing this launcher. */
  readonly label: string;
}

/** `seeya project open`'s own tab-backed `HarnessLauncher` (V2-T30 item 3) — constructed fresh per
 * `openProject` call (mirrors `TabSessionResumer`'s own "one instance per resume batch" shape),
 * never a long-lived singleton, so `label` can be this specific project's name. */
export class ProjectOpenTabLauncher implements HarnessLauncher {
  constructor(private readonly options: ProjectOpenTabLauncherOptions) {}

  open(
    cwd: string,
    addDirs: readonly string[],
    sessionId: string,
    systemPromptAppend: string | null,
  ): Promise<HarnessOpenResult> {
    return openTabAndAwaitExit(this.options.opener, {
      command: this.options.claudeCommand,
      args: buildOpenArgs(addDirs, sessionId, systemPromptAppend),
      cwd,
      label: this.options.label,
    });
  }
}

export interface ProjectAdoptTabLauncherOptions {
  readonly claudeCommand: string;
  readonly opener: TabResumeOpener;
  /** The tab's own label — the adoption's own display name (e.g. the original session's name),
   * resolved once by the caller before constructing this launcher. */
  readonly label: string;
}

/** `seeya project adopt`'s own tab-backed `SessionAdoptionLauncher` (V2-T30 item 5). */
export class ProjectAdoptTabLauncher implements SessionAdoptionLauncher {
  constructor(private readonly options: ProjectAdoptTabLauncherOptions) {}

  adopt(
    originalCwd: string,
    projectDir: string,
    originalSessionId: string,
    forkSessionId: string,
  ): Promise<HarnessOpenResult> {
    return openTabAndAwaitExit(this.options.opener, {
      command: this.options.claudeCommand,
      args: buildAdoptArgs(originalSessionId, forkSessionId, projectDir),
      cwd: originalCwd,
      label: this.options.label,
    });
  }
}
