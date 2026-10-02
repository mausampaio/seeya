/**
 * Opens the "New project…" dialog from OUTSIDE this feature (V2-T67) — same shape as
 * `renderer/features/tabs/page-tab-bridge.ts`/`focus-bridge.ts`/`tab-select-bridge.ts`: a tiny
 * pub/sub so the lateral's own `+` button (`renderer/features/sidebar/FavoritesSection/
 * FavoritesSection.tsx`, `docs/INTERFACE.md` § 1 item 3) can open the SAME dialog the Projects
 * tab's own "New project" button opens (`docs/INTERFACE.md` § 4), without either feature importing
 * the other's component tree. `NewProjectDialog.tsx` is the only module that ever calls
 * `registerNewProjectDialogOpener`, once, on mount.
 *
 * Replaces `renderer/legacy/new-project-dialog-view.ts#wireNewProjectDialog`'s own imperative
 * `document.getElementById('new-project-button').addEventListener('click', ...)` (apagado by this
 * task) — the sidebar button's own click now calls `openNewProjectDialog()` directly.
 */
type DialogOpener = () => void;

let opener: DialogOpener | null = null;

/** Called once, by `NewProjectDialog.tsx`, on mount. */
export function registerNewProjectDialogOpener(fn: DialogOpener): void {
  opener = fn;
}

/**
 * @example
 * openNewProjectDialog(); // opens (or re-opens) the "New project…" dialog
 */
export function openNewProjectDialog(): void {
  opener?.();
}
