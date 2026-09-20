/**
 * `Autostart`, one implementation per OS (docs/PLANO-DE-ENTREGA.md S5-T1) — same per-platform
 * selection shape `adapters/notification/index.ts#buildDefaultBackends` already uses. `homeDir`
 * is only used by the Linux/macOS adapters (`~/.config/systemd/user/`, `~/Library/LaunchAgents/`);
 * Windows' Task Scheduler carries no filesystem root of its own for the *registration* itself.
 *
 * **`seeyaHome` joined in V2-T23**, a SEPARATE root from `homeDir` (D-027's "raiz injetável"
 * applied here too) — all three adapters now write their own launched process's stdout/stderr
 * under it (`adapters/autostart/env.ts#AUTOSTART_OUTPUT_LOG_FILE_NAME`), never under `homeDir`
 * directly and never under `~/.claude`.
 *
 * **Only Windows was measured (docs/QUESTOES.md Q-067).** Linux and macOS are built from the
 * `systemd --user`/LaunchAgent mechanisms docs/PLANO-DE-ENTREGA.md S5-T1 names, not verified
 * against a real system by this task — see that entry's own report for what "measured" vs
 * "inferred" means for each OS.
 */
import type { Autostart } from '../../core/ports.js';
import { WindowsAutostart } from './windows.js';
import { LinuxAutostart } from './linux.js';
import { MacosAutostart } from './macos.js';

export function buildAutostart(
  homeDir: string,
  seeyaHome: string,
  platform: NodeJS.Platform = process.platform,
): Autostart {
  if (platform === 'win32') {
    return new WindowsAutostart({ seeyaHome });
  }
  if (platform === 'darwin') {
    return new MacosAutostart({ homeDir, seeyaHome });
  }
  return new LinuxAutostart({ homeDir, seeyaHome });
}
