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
 * dialog` anchors that used to live here.
 */
import { Dialog } from '../components/Dialog/Dialog.js';

export function DialogsShell() {
  return (
    <>
      <Dialog id="adopt-pick-dialog" className="project-dialog">
        <h3 id="adopt-pick-title"></h3>
        <form id="adopt-pick-form">
          <label>
            <input type="radio" name="adopt-target" id="adopt-target-existing" checked />
            Existing project
          </label>
          <select id="adopt-existing-select"></select>
          <label>
            <input type="radio" name="adopt-target" id="adopt-target-new" />
            New project
          </label>
          <input
            id="adopt-new-project-id-input"
            type="text"
            placeholder="auth-hardening"
            disabled
          />
          <p id="adopt-pick-error" class="project-dialog-error"></p>
          <div class="project-dialog-actions">
            <button type="submit" id="adopt-pick-submit"></button>
            <button type="button" id="adopt-pick-cancel"></button>
          </div>
        </form>
      </Dialog>
      <Dialog id="adopt-launch-confirm-dialog" className="project-dialog">
        <h3 id="adopt-launch-confirm-title"></h3>
        <div id="adopt-launch-confirm-lines"></div>
        <div class="project-dialog-actions">
          <button id="adopt-launch-confirm-proceed" type="button"></button>
          <button id="adopt-launch-confirm-decline" type="button"></button>
        </div>
      </Dialog>
      <Dialog id="adopt-commit-confirm-dialog" className="project-dialog">
        <h3 id="adopt-commit-confirm-title"></h3>
        <div id="adopt-commit-confirm-lines"></div>
        <div class="project-dialog-actions">
          <button id="adopt-commit-confirm-commit" type="button"></button>
          <button id="adopt-commit-confirm-decline" type="button"></button>
        </div>
      </Dialog>
      <Dialog id="adopt-result-dialog" className="project-dialog">
        <h3 id="adopt-result-title"></h3>
        <p id="adopt-result-text"></p>
        <div class="project-dialog-actions">
          <button id="adopt-result-open-project" type="button" hidden></button>
          <button id="adopt-result-close" type="button"></button>
        </div>
      </Dialog>
    </>
  );
}
