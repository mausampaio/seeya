/**
 * The "Settings" dialog (V2-T14 — split out of the former single-file `renderer.ts` by
 * V2-T62/D-051). Excluded from `packages/app/src`'s coverage floor with everything else in
 * `electron/` (it cannot run without a display).
 */
import { MESSAGES } from '../../text/messages.js';
import type { SettingsRow, ProjectPolicyLine } from '../../state/settings-panel.js';

/**
 * V2-T14 — one row per `SettingsRow` (`state/settings-panel.ts`), each with its own text input
 * and "Save" button, re-rendered from scratch on every open and after every save (the same
 * "simplest for a list this small" reasoning `today-panel-view.ts#renderTodayPanel`'s own
 * docstring already gives). No state machine of its own (unlike `endDayState`/`daemonControlState`
 * elsewhere) — sixteen independent fields, each saved on its own click, never a single in-flight
 * run to track.
 */
function settingsDialog(): HTMLDialogElement {
  return document.getElementById('settings-dialog') as HTMLDialogElement;
}

function settingsRowsContainer(): HTMLElement {
  return document.getElementById('settings-rows') as HTMLElement;
}

/** "Save" on one row (V2-T14 items 2/3): a rejected value leaves the row's own input untouched
 * (the person's typed text stays there to fix, D-039's own "never surprise" spirit) and shows the
 * refusal `main.ts` returned verbatim (AGENTS.md § "Mensagens de erro" — the raw value and the
 * expected shape, no second wording here); a saved value re-renders every row (another field's
 * `origin` line never goes stale next to the one that just changed). D-052 (V2-T75): the faixa de
 * horário is no longer repainted from `response.schedule` directly here — `main.ts`'s own
 * `saveSetting` handler now ALSO pushes the freshly recomputed schedule over `onScheduleUpdate`
 * (the same channel the ambient tick and Snooze/Skip already use), which the lateral's own
 * `SidebarFooter` subscribes to — still "don't wait for the next ambient tick", just through one
 * channel instead of two. */
async function handleSettingsSaveClicked(
  key: string,
  input: HTMLInputElement,
  errorLine: HTMLElement,
): Promise<void> {
  errorLine.textContent = '';
  const response = await window.seeya.saveSetting({ key, rawValue: input.value });
  if (!response.ok) {
    errorLine.textContent = `${MESSAGES.settingsSaveFailedPrefix}${response.error}`;
    return;
  }
  renderSettingsRows(response.rows);
}

function renderSettingsRow(row: SettingsRow): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-row';
  wrapper.dataset.key = row.key;

  // V2-T14 item 1's own "o nome, o valor em vigor, e de onde ele vem" — the key name itself,
  // exactly as `seeya config get`/`set` spell it, not just the one-line description below it.
  const name = document.createElement('strong');
  name.className = 'settings-row-name';
  name.textContent = row.key;
  wrapper.appendChild(name);

  const description = document.createElement('p');
  description.className = 'settings-row-description';
  description.textContent = row.description;
  wrapper.appendChild(description);

  const origin = document.createElement('span');
  origin.className = 'settings-row-origin';
  origin.textContent =
    row.origin === 'default' ? MESSAGES.settingsOriginDefault : MESSAGES.settingsOriginChosen;
  wrapper.appendChild(origin);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'settings-row-input';
  input.value = row.value;
  wrapper.appendChild(input);

  const errorLine = document.createElement('p');
  errorLine.className = 'settings-row-error';
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'settings-row-save';
  saveButton.textContent = MESSAGES.settingsSaveButton;
  saveButton.addEventListener('click', () => {
    void handleSettingsSaveClicked(row.key, input, errorLine);
  });
  wrapper.appendChild(saveButton);
  wrapper.appendChild(errorLine);

  return wrapper;
}

function renderSettingsRows(rows: readonly SettingsRow[]): void {
  const container = settingsRowsContainer();
  container.textContent = '';
  for (const row of rows) {
    container.appendChild(renderSettingsRow(row));
  }
}

/** V2-T14's own "o que não entra": `projectPolicy`, read-only, one line per `cwd` — same content
 * `seeya config get`'s own `projectPolicy:` section prints, never an input/Save button next to it
 * (editing it stays the CLI's job, `seeya config policy <cwd>`). Rendered once, right after
 * `getSettingsPanel` resolves — unlike the scalar rows above, nothing here ever changes from
 * inside this dialog, so there is no re-render to wire a click up to. */
function renderProjectPolicyLines(lines: readonly ProjectPolicyLine[]): void {
  const container = document.getElementById('settings-project-policy-lines') as HTMLElement;
  container.textContent = '';
  if (lines.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = MESSAGES.settingsProjectPolicyEmpty;
    container.appendChild(empty);
    return;
  }
  for (const line of lines) {
    const item = document.createElement('p');
    item.textContent = MESSAGES.settingsProjectPolicyLine(line);
    container.appendChild(item);
  }
}

/** "Settings…" clicked: re-fetches everything every time (never cached across opens — another
 * terminal's `seeya config set`/`config policy`, or this dialog's own last save, must always
 * show). */
async function handleSettingsOpenClicked(): Promise<void> {
  const response = await window.seeya.getSettingsPanel();
  renderSettingsRows(response.rows);
  renderProjectPolicyLines(response.projectPolicyLines);
  settingsDialog().showModal();
}

/** Wired once, at startup. */
export function wireSettingsDialog(): void {
  const openButton = document.getElementById('settings-button') as HTMLButtonElement;
  openButton.textContent = MESSAGES.settingsButton;
  openButton.addEventListener('click', () => {
    void handleSettingsOpenClicked();
  });
  (document.getElementById('settings-dialog-title') as HTMLElement).textContent =
    MESSAGES.settingsDialogTitle;
  (document.getElementById('settings-dialog-daemon-note') as HTMLElement).textContent =
    MESSAGES.settingsDaemonRereadsNote;
  (document.getElementById('settings-project-policy-heading') as HTMLElement).textContent =
    MESSAGES.settingsProjectPolicyHeading;
  const closeButton = document.getElementById('settings-dialog-close') as HTMLButtonElement;
  closeButton.textContent = MESSAGES.settingsDialogClose;
  closeButton.addEventListener('click', () => settingsDialog().close());
}
