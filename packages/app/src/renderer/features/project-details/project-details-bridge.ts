/**
 * Opens the "Project details" dialog from OUTSIDE this feature (V2-T83) — same shape as
 * `renderer/features/projects/new-project-dialog-bridge.ts`: a tiny pub/sub so the Projects tab's
 * own row button (`ProjectsTable`) can open the dialog `App.tsx` mounts, without the table
 * importing the dialog's component tree (and without the dialog living inside `#page-projects`,
 * whose `display: none` while another tab is active would keep a `<dialog>` from ever showing —
 * `Projects.tsx`'s own docstring). `ProjectDetailsDialog.tsx` is the only module that ever calls
 * `registerProjectDetailsOpener`, once, on mount.
 */
type DialogOpener = (projectId: string) => void;

let opener: DialogOpener | null = null;

/** Called once, by `ProjectDetailsDialog.tsx`, on mount. */
export function registerProjectDetailsOpener(fn: DialogOpener): void {
  opener = fn;
}

/**
 * @example
 * openProjectDetails('auth-hardening'); // opens the dialog for that project
 */
export function openProjectDetails(projectId: string): void {
  opener?.(projectId);
}
