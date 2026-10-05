/**
 * The application menu (V2-T74; V2-T51: moved out of `main/main.ts`) — the Electron-fiação half of
 * `composition/menu-policy.ts`.
 */
import { Menu } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import {
  resolveApplicationMenuPolicy,
  type MenuEntry,
  type MenuSection,
} from '../composition/menu-policy.js';

/**
 * V2-T74: the fiação half of `composition/menu-policy.ts#resolveApplicationMenuPolicy` — that
 * module only produces data (`ApplicationMenuPolicy`), this function is the one place that calls
 * the real Electron `Menu` API with it. `Menu.setApplicationMenu` is process-global, not
 * per-window (Electron's own docs: "the menu will be set as each window's top menu"), so this
 * runs exactly ONCE, in `app.whenReady()` below, before any `BrowserWindow` is created — never
 * from `createWindow` itself, which can run again on macOS's own `activate` (no second
 * application menu to apply there).
 *
 * `Menu.setApplicationMenu(null)` (the `'none'` branch) removes the menu bar on Windows/Linux
 * entirely, rather than just hiding it behind Alt the way the `BrowserWindow` option
 * `autoHideMenuBar` would — this task's own aceite asks for the bar to be gone, not hidden.
 */
export function applyApplicationMenuPolicy(platform: NodeJS.Platform, appName: string): void {
  const policy = resolveApplicationMenuPolicy(platform, appName);
  if (policy.kind === 'none') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(toElectronMenuTemplate(policy.template)));
}

/** `composition/menu-policy.ts`'s own `MenuSection[]` → Electron's real
 * `MenuItemConstructorOptions[]` — the one place this mapping happens, since that module cannot
 * import Electron's type at all (see its own docstring on the `electron`-stays-in-main/ boundary,
 * D-052). */
function toElectronMenuTemplate(sections: readonly MenuSection[]): MenuItemConstructorOptions[] {
  return sections.map((section) => ({
    label: section.label,
    submenu: section.submenu.map(toElectronMenuItem),
  }));
}

/** `MenuItemConstructorOptions['role']` is `(... literal roles) | undefined` (the property is
 * optional) — `NonNullable` here is what lets `toElectronMenuItem` assign a definite role value
 * under this package's own `exactOptionalPropertyTypes: true` (an explicit `role: undefined`
 * would otherwise be a different, rejected assignment from simply omitting the key). */
type ElectronMenuRole = NonNullable<MenuItemConstructorOptions['role']>;

function toElectronMenuItem(entry: MenuEntry): MenuItemConstructorOptions {
  if (entry.kind === 'separator') {
    return { type: 'separator' };
  }
  // `MenuRoleEntry.role` is a plain `string` in `composition/menu-policy.ts` (that module cannot
  // import Electron's own role union either) — every value `buildMacMenuTemplate` actually
  // produces ('about', 'quit', 'undo', 'redo', 'cut', 'copy', 'paste', 'selectAll') is one of
  // Electron's own documented `MenuItem` roles, asserted here once, at the only call site.
  return { role: entry.role as ElectronMenuRole };
}
