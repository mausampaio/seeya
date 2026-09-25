/**
 * "New project…" (V2-T30 item 4) — split out of `electron/project-panel-view.ts` (PO review,
 * 2026-09-25: that file grew past the 500-line ceiling) into its own single responsibility. Same
 * `electron/` exemption as the rest of this directory (D-041): the one mapping this dialog needed
 * (a rejected response to an error line) lives in `state/create-project-result.ts`, tested.
 */
import { MESSAGES } from '../text/messages.js';
import { formatCreateProjectErrorText } from '../state/create-project-result.js';

/** "New project…" — the same `createProject` `seeya project create` calls. A rejected id
 * (`invalidId`/`alreadyExists`) leaves the dialog open with the refusal shown, same "never
 * surprise, the typed text stays" convention `handleSettingsSaveClicked` (`renderer.ts`) already
 * follows. Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel`. */
export function wireNewProjectDialog(): void {
  const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
  (document.getElementById('new-project-dialog-title') as HTMLElement).textContent =
    MESSAGES.newProjectDialogTitle;
  const submitButton = document.getElementById('new-project-submit') as HTMLButtonElement;
  const cancelButton = document.getElementById('new-project-cancel') as HTMLButtonElement;
  submitButton.textContent = MESSAGES.newProjectSubmit;
  cancelButton.textContent = MESSAGES.newProjectCancel;
  const input = document.getElementById('new-project-id-input') as HTMLInputElement;
  const errorLine = document.getElementById('new-project-error') as HTMLElement;

  (document.getElementById('new-project-button') as HTMLButtonElement).textContent =
    MESSAGES.newProjectButton;
  document.getElementById('new-project-button')?.addEventListener('click', () => {
    input.value = '';
    errorLine.textContent = '';
    dialog.showModal();
    input.focus();
  });
  cancelButton.addEventListener('click', () => dialog.close());

  document.getElementById('new-project-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    errorLine.textContent = '';
    void window.seeya.createProject({ projectId: input.value.trim() }).then((response) => {
      if (response.kind !== 'created') {
        errorLine.textContent = formatCreateProjectErrorText(response);
        return;
      }
      dialog.close();
    });
  });
}
