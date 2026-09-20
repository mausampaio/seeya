/**
 * `AppInstallation`, one implementation per OS (V2-T13, D-045 item 2) — same per-platform
 * selection shape `adapters/autostart/index.ts#buildAutostart` already uses.
 *
 * **Only Windows was measured (docs/QUESTOES.md Q-081).** Linux and macOS follow the mechanisms
 * D-045 item 2 names, not verified against a real install by this task — see each adapter's own
 * top comment for what "measured" vs "inferred" means for it.
 */
import type { AppInstallation } from '../../core/ports.js';
import { WindowsAppInstallation } from './windows.js';
import { LinuxAppInstallation } from './linux.js';
import { MacosAppInstallation } from './macos.js';

export function buildAppInstallation(
  platform: NodeJS.Platform = process.platform,
): AppInstallation {
  if (platform === 'win32') {
    return new WindowsAppInstallation();
  }
  if (platform === 'darwin') {
    return new MacosAppInstallation();
  }
  return new LinuxAppInstallation();
}
