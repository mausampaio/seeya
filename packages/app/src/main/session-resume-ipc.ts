/**
 * IPC wiring for the Sessions tab's own `Resume` button (V2-T68, `docs/INTERFACE.md` § 5) — kept
 * OUT of `electron/main.ts` so that already thousand-line file doesn't grow (the same "own module"
 * split `session-search-ipc.ts`/`project-ipc.ts` already establish). D-041: no decision of its
 * own — every call delegates to `TabSessionResumer#resumeWithoutPrompt` (V2-T7's own tab-backed
 * `claude --resume <id>` with no prompt argument), the exact same port/adapter the fallback-
 * without-plan flow already uses.
 */
import { ipcMain } from 'electron';
import { TabSessionResumer, type TabResumeOpener } from '../resume/tab-session-resumer.js';
import { CHANNELS } from '../ipc/channels.js';
import type { ResumeSessionRequest, ResumeSessionResponse } from '../ipc/channels.js';
import type { AppContext } from '../composition/index.js';

/** Same default this file's own `main.ts` resolves `claude` to for every other tab-backed
 * launcher (`TabSessionResumer`'s own `CLAUDE_COMMAND` constant in `main.ts`/`project-ipc.ts`) —
 * a plain string literal, not worth importing across files for. */
const CLAUDE_COMMAND = 'claude';

export function wireSessionResumeIpc(context: AppContext, opener: TabResumeOpener): void {
  ipcMain.handle(
    CHANNELS.resumeSession,
    async (_event, request: ResumeSessionRequest): Promise<ResumeSessionResponse> => {
      const sessionResumer = new TabSessionResumer({
        seeyaHome: context.home.seeyaHome,
        claudeCommand: CLAUDE_COMMAND,
        opener,
        clock: context.clock,
        resolveLabel: () => request.name,
      });
      const attempt = await sessionResumer.resumeWithoutPrompt(request.sessionId, request.cwd);
      return { resumed: attempt.kind === 'resumed' };
    },
  );
}
