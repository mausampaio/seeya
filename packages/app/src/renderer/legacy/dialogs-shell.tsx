/**
 * V2-T62 (D-051): every LEGACY `<dialog>` this window has, as Preact markup instead of the static
 * HTML `index.html` used to carry — SAME ids, SAME classes, SAME nesting, no region redesigned.
 * Split out of `app-shell.tsx` on its own (over a dozen dialogs would otherwise make that file's
 * own layout markup hard to find) rather than by feature, because that is exactly how
 * `index.html` grouped them: one block, after `#app`, never inside it. Opening/closing stays
 * imperative (`.showModal()`/`.close()` by `id`, from each dialog's own `*-view.ts`) — see
 * `../ui/dialog.tsx`'s own docstring for why a Preact-rendered `<dialog>` needs no change there at
 * all.
 *
 * V2-T65: Settings is no longer one of these — `renderer/features/settings/SettingsDialog` is a
 * real, reactive component now, mounted directly in `App.tsx` with its own `open`/`onClose` state
 * instead of an imperative anchor here. V2-T69: End day left the same way —
 * `renderer/features/end-day/EndDayDialog` replaces the `#end-day-dialog` anchor below. V2-T67:
 * "New project…" left the same way — `renderer/features/projects/NewProjectDialog` replaces the
 * `#new-project-dialog` anchor that used to live here. V2-T71: four more left the same way —
 * `renderer/features/confirmations/` (`ProjectLockConfirmDialog`/`LeftoverChangesConfirmDialog`/
 * `ResumeFallbackDialog`/`DaemonOwnershipTransitionDialog`) replace the `#project-lock-confirm-
 * dialog`/`#leftover-changes-confirm-dialog`/`#fallback-dialog`/`#daemon-ownership-transition-
 * dialog` anchors that used to live here. V2-T70 (rebased onto V2-T71): the last four — the whole
 * "Adopt…" flow (`adopt-pick-dialog`/`adopt-launch-confirm-dialog`/`adopt-commit-confirm-dialog`/
 * `adopt-result-dialog`) — left the same way too, replaced by `renderer/features/adoption/
 * AdoptionDialog`, one reactive dialog for what used to be four static anchors. That was the last
 * of this file's own dialogs: nothing legacy is left to shell out, so this component now renders
 * nothing — kept (rather than deleted outright) only because `App.tsx` still mounts it and a
 * future legacy dialog could land here again before this whole file is finally removed; deleting
 * both is a small, separate cleanup for whoever next touches either.
 */
export function DialogsShell() {
  return null;
}
