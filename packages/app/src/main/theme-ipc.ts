/**
 * The effective-theme IPC (V2-T62, D-051; V2-T51: moved out of `main/main.ts`'s `wireIpc`).
 */
import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type { ThemeUpdateEvent } from '../ipc/channels.js';
import { type AppContext } from '../composition/index.js';
import { resolveEffectiveTheme } from '../theme/resolve-theme.js';

/**
 * Wires `getEffectiveTheme` and the `nativeTheme` listener. Returns the resolve-and-maybe-push
 * function `saveSetting` also calls, so a `theme` save applies live (V2-T65).
 */
export function wireThemeIpc(window: BrowserWindow, context: AppContext): () => Promise<void> {
  // V2-T62 (D-051): the window's effective theme — "system" has a live counterpart
  // (`getTerminalFontConfig` above deliberately does not, its own docstring explains why), so
  // `Config.theme` is read FRESH here, never cached on `AppContext` the way V2-T16 already
  // decided every OTHER config value should be (`context.storage.readConfig()`, the same "at the
  // moment it's needed" precedent `getSettingsPanel` below follows). `nativeTheme.shouldUseDarkColors`
  // is Electron's own live OS signal; this file never sets `nativeTheme.themeSource`, so that
  // signal always reflects the real OS preference regardless of what THIS app has pinned —
  // `resolveEffectiveTheme` (pure, unit-tested on its own) is the one place that decides what to
  // do with the two together.
  let lastSentEffectiveTheme: ThemeUpdateEvent['effectiveTheme'] | null = null;
  async function resolveAndSendEffectiveTheme(): Promise<void> {
    const config = await context.storage.readConfig();
    const effectiveTheme = resolveEffectiveTheme(config.theme, nativeTheme.shouldUseDarkColors);
    if (effectiveTheme === lastSentEffectiveTheme) {
      return;
    }
    lastSentEffectiveTheme = effectiveTheme;
    const event: ThemeUpdateEvent = { effectiveTheme };
    window.webContents.send(CHANNELS.themeUpdate, event);
  }
  const onNativeThemeUpdated = (): void => void resolveAndSendEffectiveTheme();
  nativeTheme.on('updated', onNativeThemeUpdated);
  window.once('closed', () => nativeTheme.removeListener('updated', onNativeThemeUpdated));
  ipcMain.handle(CHANNELS.getEffectiveTheme, async (): Promise<ThemeUpdateEvent> => {
    const config = await context.storage.readConfig();
    const effectiveTheme = resolveEffectiveTheme(config.theme, nativeTheme.shouldUseDarkColors);
    lastSentEffectiveTheme = effectiveTheme;
    return { effectiveTheme };
  });
  return resolveAndSendEffectiveTheme;
}
