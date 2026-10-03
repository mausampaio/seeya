/**
 * Opens the archive/unarchive confirmations (V2-T84, `docs/INTERFACE.md` § 4b/§ 9) from OUTSIDE
 * this feature — same tiny pub/sub shape as `features/project-details/project-details-bridge.ts`:
 * the Projects tab's own `Unarchive…` button and the Project details dialog's `Archive project…`
 * button open dialogs `App.tsx` mounts, without importing their component trees (and without the
 * dialogs living inside a possibly-hidden page pane, whose `display: none` keeps a `<dialog>` from
 * ever showing). Each dialog component calls its `register…` once, on mount.
 */
export interface ProjectConfirmTarget {
  readonly projectId: string;
  readonly name: string;
}

type Opener = (target: ProjectConfirmTarget) => void;

let archiveOpener: Opener | null = null;
let unarchiveOpener: Opener | null = null;

export function registerArchiveConfirmOpener(fn: Opener): void {
  archiveOpener = fn;
}

export function registerUnarchiveConfirmOpener(fn: Opener): void {
  unarchiveOpener = fn;
}

/**
 * @example
 * openArchiveConfirm({ projectId: 'auth-hardening', name: 'Auth hardening' });
 */
export function openArchiveConfirm(target: ProjectConfirmTarget): void {
  archiveOpener?.(target);
}

export function openUnarchiveConfirm(target: ProjectConfirmTarget): void {
  unarchiveOpener?.(target);
}
