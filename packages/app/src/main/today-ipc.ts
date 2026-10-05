/**
 * The "Today" panel IPC (V2-T4, V2-T9, V2-T16, V2-T18, V2-T66; V2-T51: moved out of
 * `main/main.ts`'s `wireIpc`) — the panel's own data, "Resume selected" and the fallback dialog's
 * answer.
 */
import { BrowserWindow, ipcMain } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  FallbackConfirmAnswerRequest,
  TodayPanelResponse,
  ResumeSelectedRequest,
  ResumeSummaryResponse,
  ResumeProgressUpdateEvent,
} from '../ipc/channels.js';
import { findPendingBriefing } from '@seeya-ai/engine/application/find-pending-briefing.js';
import { readCwdHistory } from '@seeya-ai/engine/application/cwd-history.js';
import { resumeSessions } from '@seeya-ai/engine/application/start-day.js';
import type { Handoff } from '@seeya-ai/engine/core/types.js';
import { type AppContext } from '../composition/index.js';
import { buildLiveSessionIndex } from '../sidebar/sidebar-data.js';
import { buildTodayPanelData } from '../state/today-panel.js';
import { buildResumeSummary } from '../state/resume-summary.js';
import { PendingFallbackRequests } from '../resume/pending-fallback-requests.js';
import { buildFallbackConfirmer } from '../resume/fallback-confirmer.js';
import { TabSessionResumer, type TabResumeOpener } from '../resume/tab-session-resumer.js';
import type { AmbientState } from './ambient-state.js';

/** `TabSessionResumer`'s `claudeCommand` in production — the same default the CLI's own
 * `ClaudeSessionResumer#resolveClaudeBinary` falls back to when nothing overrides it
 * (`adapters/resumption/resumer.ts`'s own `DEFAULT_CLAUDE_BINARY`, not exported — this is the app's
 * own copy of that one literal, resolved for real here via `context.resolveHarnessCommand`, unlike
 * the CLI which hands the bare string straight to `node:child_process.spawn`). */
const CLAUDE_COMMAND = 'claude';

export interface TodayIpc {
  /** Rebuilds the panel from storage and refreshes the cache the ambient tick reuses. */
  buildFreshTodayPanelData(): Promise<TodayPanelResponse>;
}

export function wireTodayIpc(
  window: BrowserWindow,
  context: AppContext,
  state: AmbientState,
  tabResumeOpener: TabResumeOpener,
): TodayIpc {
  // V2-T4 item 3: at most one truly pending in production (`resumeSessions`'s own sequential
  // loop), but keyed independently by requestId anyway — `PendingFallbackRequests`'s own docstring.
  const pendingFallbackRequests = new PendingFallbackRequests();

  // V2-T4 item 3: the renderer's answer to one confirmFallbackRequest — resolving a stale or
  // unknown requestId is a no-op (PendingFallbackRequests.resolve's own docstring), so a late
  // answer after the window reloaded mid-question never throws here.
  ipcMain.on(CHANNELS.confirmFallbackAnswer, (_event, answer: FallbackConfirmAnswerRequest) => {
    pendingFallbackRequests.resolve(answer.requestId, answer.decision);
  });

  // V2-T4 item 1: the "Today" panel's own data — findPendingBriefing is the exact same lookup
  // `seeya start-day` does (application/find-pending-briefing.js), scanned over
  // config.maxBriefingScanDays like the CLI's own StartDayCommandContext.
  //
  // V2-T9 item 1/2: one readCwdHistory per handoff in the found briefing, over the SAME
  // maxBriefingScanDays ceiling — a session's directory history never reaches further back than
  // the scan that found `lookup.briefing.day` in the first place. Skipped entirely when nothing
  // was found (nothing to build a history for).
  //
  // V2-T16: `maxBriefingScanDays` is read fresh from `config.json` every time this panel is
  // rebuilt, never a value cached from window startup — same discipline `getSettingsPanel` below
  // already follows.
  //
  // V2-T66: extracted out of the `getTodayPanel` handler (its only caller before this task) so
  // `endDayRun` below can also rebuild and PUSH a fresh value once a real end-day run finishes —
  // the Today tab is a real component now (`renderer/features/today/Today.tsx`), mounted once for
  // the life of the window and driven entirely by `onTodayUpdate`/its own mount-time fetch, with
  // no imperative `refreshTodayPanel()` escape hatch left for a sibling dialog to call into it
  // (unlike the deleted `renderer/legacy/today-panel-view.ts`, which `renderer/legacy/
  // end-day-dialog-view.ts` used to call directly after "Run end-day now" resolved).
  async function buildFreshTodayPanelData(): Promise<TodayPanelResponse> {
    const config = await context.storage.readConfig();
    const lookup = await findPendingBriefing(
      context.storage,
      context.clock,
      config.maxBriefingScanDays,
    );
    if (!lookup.found) {
      state.latestTodayPanelInputs = { lookup, cwdHistoryBySessionId: new Map() };
      return buildTodayPanelData(lookup);
    }
    const cwdHistoryEntries = await Promise.all(
      lookup.briefing.handoffs.map(async (handoff) => {
        const history = await readCwdHistory(
          {
            storage: context.storage,
            directoryExistence: context.directoryExistence,
            platformHint: context.platformHint,
          },
          handoff.sessionId,
          lookup.briefing.day,
          config.maxBriefingScanDays,
        );
        return [handoff.sessionId, history] as const;
      }),
    );
    // V2-T9 item 4: "running now" from THIS session's own most recent discovery, not from
    // resumed.json — see buildLiveSessionIndex's own docstring for why the two disagree.
    const liveSessionIds = buildLiveSessionIndex(state.latestSidebarRows);
    const cwdHistoryBySessionId = new Map(cwdHistoryEntries);
    // V2-T18 item 2: cached for the refresh tick below (refreshTodayPanelLiveness) — the lookup
    // and cwd history just built here stay valid until the next rebuild; only liveness needs to be
    // fresh every tick.
    state.latestTodayPanelInputs = { lookup, cwdHistoryBySessionId };
    return buildTodayPanelData(lookup, cwdHistoryBySessionId, liveSessionIds);
  }

  ipcMain.handle(CHANNELS.getTodayPanel, (): Promise<TodayPanelResponse> =>
    buildFreshTodayPanelData(),
  );

  // V2-T4 items 1/2/3: "Resume selected" — the same resumeSessions the CLI's start-day-command.ts
  // calls, with a TabSessionResumer instead of ClaudeSessionResumer and a dialog-backed
  // FallbackConfirmer instead of readline (D-039: this NEVER runs on its own, only from this one
  // handler, itself only ever called by the person's own click — renderer.ts's "Resume selected"
  // button).
  ipcMain.handle(
    CHANNELS.resumeSelected,
    async (_event, request: ResumeSelectedRequest): Promise<ResumeSummaryResponse> => {
      const briefing = await context.storage.readBriefing(request.day);
      const wanted = new Set(request.sessionIds);
      // V2-T9 item 2: a chosen directory overrides the handoff's own `cwd` for THIS resume
      // attempt only — nothing is rewritten to `~/.seeya/` (the panel's own note, D-039). A
      // sessionId absent from `chosenCwdBySessionId` had no selector to choose from at all (a
      // single-directory history), so the handoff's own `cwd` is used unchanged.
      const handoffs: readonly Handoff[] = (briefing?.handoffs ?? [])
        .filter((handoff) => wanted.has(handoff.sessionId))
        .map((handoff) => {
          const chosenCwd = request.chosenCwdBySessionId[handoff.sessionId];
          return chosenCwd === undefined ? handoff : { ...handoff, cwd: chosenCwd };
        });

      const resolveLabel = (sessionId: string): string =>
        handoffs.find((handoff) => handoff.sessionId === sessionId)?.name ?? sessionId;
      const sessionResumer = new TabSessionResumer({
        seeyaHome: context.home.seeyaHome,
        claudeCommand: CLAUDE_COMMAND,
        opener: tabResumeOpener,
        clock: context.clock,
        resolveLabel,
      });
      const confirmFallback = buildFallbackConfirmer(pendingFallbackRequests, (confirmRequest) =>
        window.webContents.send(CHANNELS.confirmFallbackRequest, confirmRequest),
      );

      const result = await resumeSessions(
        { storage: context.storage, sessionResumer, confirmFallback },
        { day: request.day, handoffs },
        (progressEvent) => {
          const event: ResumeProgressUpdateEvent = {
            index: progressEvent.index,
            total: progressEvent.total,
            name: progressEvent.handoff.name,
          };
          window.webContents.send(CHANNELS.resumeProgress, event);
        },
      );

      // PO review of V2-T66 (2026-09-xx): the sidebar's own "Today" card reads the SAME
      // `todayUpdate` channel (useSidebar.ts) as the Today tab itself — pushing the freshly
      // resumed state here, right after resumeSessions resolves, is what keeps the sidebar's
      // count in sync with the tab's own result at the same instant, instead of leaving it stale
      // until the next ambient refresh tick (up to REFRESH_INTERVAL_MS away). Same pattern as
      // `endDayRun` above.
      window.webContents.send(CHANNELS.todayUpdate, await buildFreshTodayPanelData());

      return buildResumeSummary(result, resolveLabel);
    },
  );

  return { buildFreshTodayPanelData };
}
