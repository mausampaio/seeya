/**
 * `Autostart`, one implementation per OS (docs/PLANO-DE-ENTREGA.md S5-T1) — same per-platform
 * selection shape `adapters/notification/index.ts#buildDefaultBackends` already uses. `homeDir`
 * is only used by the Linux/macOS adapters (`~/.config/systemd/user/`, `~/Library/LaunchAgents/`);
 * Windows' Task Scheduler carries no filesystem root of its own.
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
  platform: NodeJS.Platform = process.platform,
): Autostart {
  if (platform === 'win32') {
    return new WindowsAutostart();
  }
  if (platform === 'darwin') {
    return new MacosAutostart({ homeDir });
  }
  return new LinuxAutostart({ homeDir });
}
