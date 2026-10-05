/**
 * The "End day…" IPC (V2-T5a, V2-T69; V2-T51: moved out of `main/main.ts`'s `wireIpc`) — the
 * dry-run preview and the real run.
 */
import { BrowserWindow, ipcMain } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type { EndDayPreviewResponse, EndDayRunResponse } from '../ipc/channels.js';
import { endDay } from '@seeya-ai/engine/application/end-day.js';
import { buildEndDayNotice } from '@seeya-ai/engine/application/end-day-notice.js';
import { toEndDayDeps, type AppContext } from '../composition/index.js';
import { buildEndDayCostCeiling } from '../state/end-day-preview.js';
import { buildEndDayPreviewRows, buildEndDayResultRows } from '../state/end-day-sessions.js';
import { projectEndDayProgressEvent } from '../state/end-day-progress.js';
import type { TodayIpc } from './today-ipc.js';

export function wireEndDayIpc(window: BrowserWindow, context: AppContext, today: TodayIpc): void {
  // V2-T5a item 4: "a execução ... uma por vez" — the renderer already disables "Run end-day now"
  // while `running`, but this is the same defense-in-depth `ipcMain.handle(CHANNELS.resumeSelected`
  // above relies on the renderer alone for (no second guard there) — end-day gets one anyway
  // because a REAL run terminates opted-in sessions (D-002), a consequence worth refusing a stray
  // concurrent call over rather than trusting the renderer alone.
  let endDayRunInProgress = false;

  // V2-T5a item 1, reworked by V2-T69 into structured rows: "End day..." — the dry-run preview
  // shown as the confirmation itself (D-039, D-002: this NEVER writes a handoff or terminates a
  // process — dryRun: true stops every write right before it happens, application/end-day.ts's own
  // top comment). skipGeneration: true (review fix) means this NEVER calls a real generator either
  // — unlike `seeya end-day --dry-run` itself (whose own contract, S2-T5, still calls the real
  // lean generator during a dry run: a command the person already decided to run), a preview the
  // person has NOT confirmed anything for yet must not spend a real, billed model call — see
  // EndDayOptions.skipGeneration's own docstring for the full reasoning.
  // `state/end-day-sessions.ts#buildEndDayPreviewRows` is the SAME `EndDayResult` `seeya end-day
  // --dry-run`'s own `formatEndDayReport` reads, just shaped into the "Will be captured"/"Not
  // captured" lists `docs/INTERFACE.md` § 6 asks for instead of that function's literal paragraph
  // (principle 5) — its CONTENT still differs from `seeya end-day --dry-run` for lean sessions
  // specifically, honestly (D-025): no "understanding" this preview never produced, since none of
  // these rows carry one. The cost ceiling has no CLI equivalent, so it's computed here.
  //
  // V2-T16: `config` is read fresh, right here, for the cost-ceiling rendering — `endDay` itself
  // already reads its own fresh copy internally (`application/end-day.ts`'s own
  // `storage.readConfig()` call), so this was never about `endDay`'s behavior; it was `main.ts`
  // formatting the RESULT against a config snapshot taken at window startup.
  //
  // PO review round 2 (V2-T69, item 1): the cost ceiling counts `willBeCaptured.length`, never the
  // engine's own `result.sessionsInScope` — three different numbers (the cost ceiling, the running
  // view's own "i of M", and "Will be captured"'s own total) all described slightly different
  // populations before this fix. `sessionsInScope` also counts cheap-ineligible AND genuinely-
  // failing sessions, neither of which ever reaches the paid generation step (a `CaptureFailure`
  // can ONLY arise from `gatherEvidence`/eligibility-assembly I/O — `end-day.ts#captureSessionOutcome`
  // never lets a GENERATOR failure become one; that's swallowed into a `deterministic` handoff
  // instead), so counting them toward "how much could this cost" overstated the ceiling. The SAME
  // `willBeCaptured.length` also seeds `state/end-day-panel.ts#seedTrackedSessions`'s own `total` —
  // one number, three readers.
  ipcMain.handle(CHANNELS.endDayPreview, async (): Promise<EndDayPreviewResponse> => {
    const result = await endDay(toEndDayDeps(context), {
      dryRun: true,
      skipGeneration: true,
      scope: { kind: 'fullDay' },
    });
    const config = await context.storage.readConfig();
    const { willBeCaptured, notCaptured } = buildEndDayPreviewRows(
      result,
      context.homeDir,
      context.platformHint,
    );
    return {
      willBeCaptured,
      notCaptured,
      costCeiling: buildEndDayCostCeiling(willBeCaptured.length, config),
    };
  });

  // V2-T5a item 4, reworked by V2-T69: "Run end-day now" — the real run (dryRun: false), notified
  // through the SAME Notifier/buildEndDayNotice seeya end-day uses (composition/index.ts
  // #buildAppContext wires the real adapter, D-020). The status panel picks up whatever this run
  // wrote/terminated on its own next tick (runRefreshLoop below, at most REFRESH_INTERVAL_MS away —
  // no separate push needed). `buildEndDayResultRows` replaces `formatEndDayReport` here — the
  // response is the same `EndDayResult`'s own captured/failed/skipped buckets, structured.
  //
  // V2-T66: the "Today" panel is refreshed and PUSHED from here, not fetched explicitly by the
  // renderer after this resolves — `renderer/legacy/end-day-dialog-view.ts` (apagado by V2-T69,
  // and already apagado of its own `today-panel-view.ts#refreshTodayPanel()` call by V2-T66) used
  // to call that for a DOM-at-hand panel; Today is a real, independently-mounted component now
  // (`renderer/features/today/Today.tsx`) with no reference a sibling dialog could call into —
  // `CHANNELS.todayUpdate`, the same push every ambient refresh tick already uses, is the only
  // channel left that reaches it.
  ipcMain.handle(CHANNELS.endDayRun, async (): Promise<EndDayRunResponse> => {
    if (endDayRunInProgress) {
      throw new Error('an end-day run is already in progress');
    }
    endDayRunInProgress = true;
    try {
      const result = await endDay(toEndDayDeps(context), {
        dryRun: false,
        scope: { kind: 'fullDay' },
        onCaptureProgress: (event) => {
          window.webContents.send(CHANNELS.endDayProgress, projectEndDayProgressEvent(event));
        },
      });
      const notice = buildEndDayNotice(result);
      if (notice !== null) {
        try {
          await context.notifier.notify(notice);
        } catch {
          // Same discipline as cli/end-day-command.ts#notifyEndDayResult: a broken notifier must
          // never derail the day's own ending.
        }
      }
      window.webContents.send(CHANNELS.todayUpdate, await today.buildFreshTodayPanelData());
      return buildEndDayResultRows(result, context.homeDir, context.platformHint);
    } finally {
      endDayRunInProgress = false;
    }
  });
}
