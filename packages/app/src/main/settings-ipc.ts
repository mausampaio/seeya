/**
 * The Settings / static-value IPC (V2-T3, V2-T14, V2-T16, V2-T65; V2-T51: moved out of
 * `main/main.ts`'s `wireIpc`) — the terminal font config, the app version, the home directory,
 * the Settings panel's rows and the save round trip.
 */
import { BrowserWindow, ipcMain } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  TerminalFontConfigResponse,
  SettingsPanelResponse,
  SaveSettingRequest,
  SaveSettingResponse,
} from '../ipc/channels.js';
import {
  applyConfigFieldUpdate,
  parseConfigFieldUpdate,
} from '@seeya-ai/engine/adapters/storage/config-schema.js';
import { saveConfigChange } from '@seeya-ai/engine/application/config-update.js';
import { type AppContext } from '../composition/index.js';
import { buildSettingsRows, buildProjectPolicyLines } from '../state/settings-panel.js';
import { computeScheduleEvent } from './schedule-ipc.js';

export function wireSettingsIpc(
  window: BrowserWindow,
  context: AppContext,
  resolveAndSendEffectiveTheme: () => Promise<void>,
): void {
  // V2-T3: fetched once by `renderer.ts#main`, before any `new Terminal({...})` is constructed —
  // the two-way handshake (`invoke`, not `send`) matches `createTab` below, the only other channel
  // the renderer needs a value back from. V2-T16: `AppContext.initialTerminalFontOptions` is
  // already the resolved shape (read once, at startup, on purpose — see that field's own
  // docstring), so this handler needs no `Config` read of its own.
  ipcMain.handle(
    CHANNELS.getTerminalFontConfig,
    (): TerminalFontConfigResponse => context.initialTerminalFontOptions,
  );

  // V2-T65 (PO review): Settings' own General section — `__SEEYA_APP_VERSION__`
  // (`build-constants.d.ts`'s own docstring has why this is never `app.getVersion()`), never
  // pushed: a running window's own installed version cannot change under it until relaunched.
  ipcMain.handle(CHANNELS.getAppVersion, (): string => __SEEYA_APP_VERSION__);
  // V2-T66 PO review, item 2: `context.homeDir` (never `os.homedir()` read fresh here or in the
  // renderer) — it already carries `SEEYA_APP_HOME_OVERRIDE` when a verification run set one, so
  // the `~`-abbreviation a verification screenshot proves is against the SAME home the fixture
  // itself was built under, not the real machine's.
  ipcMain.handle(CHANNELS.getHomeDir, (): string => context.homeDir);

  // V2-T14 item 1: the Settings dialog's own rows — re-read from disk on every open (never cached,
  // unlike `getTerminalFontConfig`: `seeya config set` in another terminal, or this same dialog's
  // own previous save, must always be reflected the next time it's opened).
  ipcMain.handle(CHANNELS.getSettingsPanel, async (): Promise<SettingsPanelResponse> => {
    const config = await context.storage.readConfig();
    return { rows: buildSettingsRows(config), projectPolicyLines: buildProjectPolicyLines(config) };
  });

  // V2-T14 items 2/3: "Save" on one Settings row — the SAME validation/write path `seeya config
  // set` uses (`parseConfigFieldUpdate`/`applyConfigFieldUpdate` + `Storage.saveConfig`), never a
  // second validation of its own. On success, the faixa de horário is recomputed right here from
  // the value that was just written — `decideSchedule` needs `dayState` too, read fresh the same
  // way `runRefreshLoop`'s own `onTick` below already does, never a stale one from an earlier tick.
  ipcMain.handle(
    CHANNELS.saveSetting,
    async (_event, request: SaveSettingRequest): Promise<SaveSettingResponse> => {
      const parsed = parseConfigFieldUpdate(request.key, request.rawValue);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }
      // V2-T50: the shared write path (`application/config-update.ts`, also used by `seeya config
      // set`) — a changed `endOfDayTime` zeroes today's snooze, and the recompute below reads the
      // already-cleared day state, so the strip comes back without the old "+1h".
      const { config: updated } = await saveConfigChange(
        context.storage,
        context.clock,
        (current) => applyConfigFieldUpdate(current, parsed.key, parsed.value),
      );

      const scheduleEvent = await computeScheduleEvent(context, updated);
      // D-052 (V2-T75): pushed too, not just returned in the response — the lateral's own
      // schedule strip (`renderer/features/sidebar/SidebarFooter`) is a reactive component now,
      // driven ONLY by `onScheduleUpdate` pushes (the same channel the ambient tick above already
      // uses); without this push it would show the STALE schedule until the next tick (up to
      // `REFRESH_INTERVAL_MS`), the exact regression `settings-dialog-view.ts`'s own comment on
      // this response field was written to prevent in the FIRST place, before the Settings dialog
      // moved to `renderer/legacy/`.
      window.webContents.send(CHANNELS.scheduleUpdate, scheduleEvent);
      // V2-T65 (PO review, 2026-10-01 — "troca de tema só vale depois de fechar e abrir o app"):
      // a `theme` save used to rely on `nativeTheme.on('updated', ...)` to ever push
      // `themeUpdate` — which only fires on an OS-level light/dark change, never on this save. The
      // window's own `data-theme`/terminal colours (`renderer/legacy/theme-view.ts#wireTheme`)
      // are driven ONLY by that push, so picking Light/Dark/System in Settings silently did
      // nothing until the next relaunch. Reusing the SAME resolve-and-maybe-push function the
      // native-theme listener already calls, right here, is what makes a save apply live — it
      // already no-ops when the effective theme didn't actually change (e.g. System picked on a
      // machine whose OS is already light), so this costs nothing on every OTHER field's save.
      await resolveAndSendEffectiveTheme();
      return {
        ok: true,
        rows: buildSettingsRows(updated),
        schedule: scheduleEvent,
      };
    },
  );
}
