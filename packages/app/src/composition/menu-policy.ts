/**
 * V2-T74 (`docs/INTERFACE.md` § "Moldura da janela"): which native application menu the window
 * gets, as a pure function of the platform — the system title bar (minimize/maximize/close) stays
 * on every platform (this app never draws its own window chrome, D-042); what varies is only the
 * menu BAR Electron would otherwise add above it.
 *
 * **Windows/Linux: no menu at all** (`{ kind: 'none' }`) — `main/application-menu.ts#applyApplicationMenuPolicy`
 * answers this with `Menu.setApplicationMenu(null)`, which removes the bar entirely rather than
 * just hiding it behind Alt (`autoHideMenuBar` would do that instead; this task's own aceite asks
 * for the bar to be gone, not hidden).
 *
 * **macOS: a minimal app menu plus Edit** (`{ kind: 'minimalWithEdit' }`) — never `'none'` there.
 * Electron's own Menu documentation (`https://www.electronjs.org/docs/latest/api/menu`, "Standard
 * Menus (macOS)" / the `editMenu` role) says the Edit menu role "is required to get full
 * functionality for standard keyboard shortcuts on macOS, including the use of the Cut, Copy,
 * Paste, and Select All menu items" — on macOS, `Cmd+C`/`Cmd+V`/etc. are resolved through the
 * application's own menu `keyEquivalent`s at the OS level (Cocoa's menu/responder-chain system);
 * with no menu carrying a matching role, those shortcuts never reach the focused web contents at
 * all, in a plain `<input>` AND in `@xterm/xterm`'s own hidden textarea alike
 * (`renderer/features/tabs/TerminalPane/TerminalPane.tsx`). Windows and Linux have no such
 * dependency — Chromium resolves `Ctrl+C`/`Ctrl+V` as native editing commands on whatever is
 * focused regardless of any menu's existence, which is what makes `'none'` safe there.
 *
 * `appName` is a parameter, not a direct `app.name` read, so this stays callable without
 * Electron's `app` module ever initializing — the same "pure function of what the caller already
 * read" shape `protocol-scheme.ts`/`window-icon.ts` already use.
 *
 * **No `import ... from 'electron'` here, on purpose.** `eslint.config.js`'s own
 * `no-restricted-imports` rule (D-052) confines `electron` to `packages/app/src/main/**` — even a
 * type-only import is restricted, so the template below uses `MenuEntry`/`MenuSection`, a small
 * structural shape of this module's own, instead of Electron's `MenuItemConstructorOptions`.
 * `main/application-menu.ts#applyApplicationMenuPolicy` is the one place that maps it onto the real Electron
 * type when calling `Menu.buildFromTemplate`.
 *
 * @example
 * resolveApplicationMenuPolicy('win32', 'seeya')   // → { kind: 'none' }
 * resolveApplicationMenuPolicy('linux', 'seeya')   // → { kind: 'none' }
 * resolveApplicationMenuPolicy('darwin', 'seeya')  // → { kind: 'minimalWithEdit', template: [...] }
 */

/** One actionable item in a menu's `submenu` — a standard Electron role (e.g. `'copy'`), never a
 * custom label/click handler: this task only ever needs roles Electron itself implements. */
export interface MenuRoleEntry {
  readonly kind: 'role';
  readonly role: string;
}

/** A visual divider between groups of `MenuRoleEntry` — Electron's own `{ type: 'separator' }`. */
export interface MenuSeparatorEntry {
  readonly kind: 'separator';
}

/** Discriminated on `kind` (D-024: "nothing flattened"), not on whether `role` happens to be
 * present — `main/application-menu.ts#toElectronMenuItem` switches on it before ever reading `role`. */
export type MenuEntry = MenuRoleEntry | MenuSeparatorEntry;

/** One top-level entry of the menu bar (e.g. the app menu, or "Edit"), with its own `submenu`. */
export interface MenuSection {
  readonly label: string;
  readonly submenu: readonly MenuEntry[];
}

export type ApplicationMenuPolicy =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'minimalWithEdit';
      readonly template: readonly MenuSection[];
    };

export function resolveApplicationMenuPolicy(
  platform: NodeJS.Platform,
  appName: string,
): ApplicationMenuPolicy {
  if (platform !== 'darwin') {
    return { kind: 'none' };
  }
  return { kind: 'minimalWithEdit', template: buildMacMenuTemplate(appName) };
}

/**
 * The app menu (About/Quit) plus Edit (Undo/Redo/Cut/Copy/Paste/Select All) — nothing else from
 * Electron's own default template (File/View/Window/Help, with Reload, Toggle Developer Tools,
 * zoom, and Toggle Full Screen) survives on any platform; see this task's own backlog notes for
 * the full list of what the default menu used to give for free and what disappears.
 *
 * **Quit stays, even though `main/main.ts`'s own `window-all-closed` handler never quits on
 * macOS when a window closes.** Without it, the only way to end the process on macOS is the Dock
 * icon's own context menu — a menu-driven Quit (and its `Cmd+Q` accelerator) is the convention a
 * mac user expects from any app menu, minimal or not.
 */
function buildMacMenuTemplate(appName: string): MenuSection[] {
  const separator: MenuSeparatorEntry = { kind: 'separator' };
  const role = (role: string): MenuRoleEntry => ({ kind: 'role', role });
  return [
    {
      label: appName,
      submenu: [role('about'), separator, role('quit')],
    },
    {
      label: 'Edit',
      submenu: [
        role('undo'),
        role('redo'),
        separator,
        role('cut'),
        role('copy'),
        role('paste'),
        role('selectAll'),
      ],
    },
  ];
}
