/**
 * The "Adopt…" picker's own decision (V2-T30 item 5): which `projectId` the person chose, from the
 * two radio-backed inputs (`<select>` for an existing project, `<input>` for a new one's id).
 * Pulled out of `electron/adopt-flow-view.ts` (PO review, 2026-09-25) so this small decision has
 * its own test instead of living inline in a form's `submit` handler.
 */

/**
 * `null` means "nothing usable was chosen" — an empty `<select>` (no project exists yet) or a
 * blank/whitespace-only typed id — never guessed into a project name (D-025). The caller shows
 * `MESSAGES.adoptPickNoProjectChosen` for `null`, never submits with an empty string.
 *
 * @example
 * resolveChosenAdoptProjectId(false, 'auth-hardening', '') // 'auth-hardening'
 * resolveChosenAdoptProjectId(true, 'auth-hardening', ' new-project ') // 'new-project'
 * resolveChosenAdoptProjectId(true, 'auth-hardening', '   ') // null
 */
export function resolveChosenAdoptProjectId(
  useNewProject: boolean,
  existingProjectSelection: string,
  newProjectIdInput: string,
): string | null {
  const chosen = (useNewProject ? newProjectIdInput : existingProjectSelection).trim();
  return chosen === '' ? null : chosen;
}
