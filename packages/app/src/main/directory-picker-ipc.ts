/**
 * The New tab popover's "Browse…" button (V2-T64, `docs/INTERFACE.md` § 2) — the native OS folder
 * picker. Its own module, same "`main.ts` doesn't grow" split `project-ipc.ts`/
 * `session-search-ipc.ts` already established: one `ipcMain.handle`, nothing else. `electron/`'s
 * own coverage exemption applies here too (D-041: this cannot run without a real native dialog).
 */
import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type { PickDirectoryResponse } from '../ipc/channels.js';

/**
 * @example
 * wireDirectoryPickerIpc(window); // "Browse…" now opens the real OS folder picker
 */
export function wireDirectoryPickerIpc(window: BrowserWindow): void {
  ipcMain.handle(CHANNELS.pickDirectory, async (): Promise<PickDirectoryResponse> => {
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
    const path = result.filePaths[0];
    if (result.canceled || path === undefined) {
      return { canceled: true };
    }
    return { canceled: false, path };
  });
}
