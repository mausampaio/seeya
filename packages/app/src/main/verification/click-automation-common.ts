/**
 * What every click automation that has to get a stray daemon-ownership dialog out of the way
 * shares (V2-T51: moved out of `createWindow` in `main/main.ts`).
 */

// V2-T68: `SEEYA_APP_AUTO_OPEN_OTHER_SESSIONS_DIR`'s own docstring used to open this comment —
// removed along with that flag (see this file's own `SEEYA_APP_AUTO_OPEN_SESSIONS_TAB`, below,
// for its replacement). Every flag below that calls `dismissDaemonOwnershipTransitionScript`
// still shares this: a verification run's own machine may have `seeya` already
// installed, which pops the (unrelated) daemon-ownership-transition dialog on top of everything
// else the moment its own async check resolves (`AppContext#checkDaemonOwnershipTransitionOffer`)
// — dismissed defensively, before either flag's own click, so it never blocks a screenshot this
// task's own verification never meant to be about that dialog at all.
// Also defensively re-expands the sidebar: `localStorage`'s own collapse preference
// (`state/sidebar-collapse.ts`) lives in this Electron binary's own userData, not under
// `SEEYA_APP_HOME_OVERRIDE` — a PRIOR verification run against this same unpackaged binary
// (V2-T30's own `SEEYA_APP_AUTO_TOGGLE_SIDEBAR`) can leave it collapsed for every run after,
// hiding the very rows this task's own flags exist to screenshot.
export const dismissDaemonOwnershipTransitionScript =
  "document.getElementById('daemon-ownership-transition-decline')?.click(); " +
  "if (document.getElementById('sidebar')?.classList.contains('collapsed')) { " +
  "document.getElementById('sidebar-toggle-button')?.click(); }";
