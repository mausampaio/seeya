/**
 * "New project…" (`docs/INTERFACE.md` § 4/§ 9's own "New project" confirmation), as a real,
 * reactive `Dialog` (V2-T67, D-052 item 2 — "componente não toca o DOM à mão") — replaces
 * `renderer/legacy/new-project-dialog-view.ts`/the static `<Dialog id="new-project-dialog">`
 * anchor in `renderer/legacy/dialogs-shell.tsx` (both apagados by this task). Same fields, same
 * `CHANNELS.createProject` IPC call, same rejection mapping (`state/create-project-result.ts`,
 * unchanged) — this task brings the FORM to the design system, it never adds a field the legacy
 * one didn't have.
 *
 * Opened from two places (the lateral's own `+`, `FavoritesSection.tsx`, AND the Projects tab's
 * own "New project" button, `Projects.tsx`) through `new-project-dialog-bridge.ts`'s own
 * `openNewProjectDialog()` — this component owns the open/closed state itself and registers the
 * opener once, on mount, same "mounts once for the life of the window" lifetime `SettingsDialog`
 * already has (mounted directly by `App.tsx`).
 *
 * **ids kept exactly** (`new-project-button` on the sidebar's own trigger, `new-project-id-input`,
 * `new-project-cancel`) — `main/main.ts#verifyTextFieldClipboardRoundTrip` (V2-T74) drives this
 * dialog by those exact ids with `executeJavaScript`, unrelated to this task and left untouched.
 *
 * **V2-T71 (`docs/INTERFACE.md` § 9 — "New project: campo `Project id` com o formato explicado no
 * erro"): the id's shape is checked locally, with the engine's own `core/
 * project-id.ts#isValidProjectId` — the SAME regex `createProject` itself would reject against,
 * never a second, looser one — the instant the field loses focus, so a malformed id never has to
 * round-trip to the engine to be told it's wrong. The engine's own `invalidId`/`alreadyExists`
 * rejections (a submit this check let through some other way, or a duplicate id) still show
 * through `formatCreateProjectErrorText`, unchanged — this task adds a FASTER, more specific
 * error for the one case a person can fix without ever reaching the engine, never removes the
 * other one.
 *
 * @example
 * <NewProjectDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX, TargetedEvent } from 'preact';
import styles from './NewProjectDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { TextField } from '../../../components/TextField/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import { formatCreateProjectErrorText } from '../../../../state/create-project-result.js';
import { registerNewProjectDialogOpener } from '../new-project-dialog-bridge.js';
import { isValidProjectId } from '@seeya-ai/engine/core/project-id.js';

export function NewProjectDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // V2-T71: checked on blur, same "the field itself tells you, before you ever submit" moment
  // `docs/INTERFACE.md` § 8 already uses for Settings' own fields — a still-focused field that
  // simply hasn't been typed into yet never shows this (an empty string is never "malformed",
  // it's just not filled in yet).
  function handleIdBlur(value: string): void {
    setError(
      value.length > 0 && !isValidProjectId(value) ? MESSAGES.newProjectIdFormatError : undefined,
    );
  }

  // Registered once — the SAME "mounts once, the real implementation is in place before anyone
  // can click" guarantee `page-tab-bridge.ts`'s own docstring already relies on.
  useEffect(() => {
    registerNewProjectDialogOpener(() => {
      setProjectId('');
      setError(undefined);
      setOpen(true);
    });
  }, []);

  function handleSubmit(event: TargetedEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedId = projectId.trim();
    // V2-T71: a submit via Enter never has to blur the field first — the SAME check `handleIdBlur`
    // above runs, so a malformed id is caught here too, never sent to the engine at all.
    if (!isValidProjectId(trimmedId)) {
      setError(MESSAGES.newProjectIdFormatError);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    void getSeeyaApi()
      .createProject({ projectId: trimmedId })
      .then((response) => {
        setSubmitting(false);
        if (response.kind !== 'created') {
          // Same "never surprise, the typed text stays" convention the legacy dialog already
          // followed — the dialog stays open, with the refusal shown next to the field.
          setError(formatCreateProjectErrorText(response));
          return;
        }
        setOpen(false);
      })
      .catch((error: unknown) => {
        // V2-T34 production defect's own "a janela nunca fecha em silêncio numa falha
        // inesperada" — `createProject` itself never threw a documented case before this task,
        // but a rejected IPC promise (a genuinely unexpected error) must still surface somewhere
        // rather than leave `submitting` stuck forever.
        setSubmitting(false);
        setError(
          MESSAGES.newProjectUnexpectedError(
            error instanceof Error ? error.message : String(error),
          ),
        );
      });
  }

  return (
    <Dialog
      id="new-project-dialog"
      title={MESSAGES.newProjectDialogTitle}
      open={open}
      onClose={() => setOpen(false)}
      className={cx(styles, 'dialog')}
    >
      <form id="new-project-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextField
            id="new-project-id-input"
            label={MESSAGES.newProjectIdLabel}
            value={projectId}
            placeholder="auth-hardening"
            error={error}
            disabled={submitting}
            onInput={setProjectId}
            onBlur={handleIdBlur}
          />
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button
              id="new-project-cancel"
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {MESSAGES.newProjectCancel}
            </Button>
            <Button id="new-project-submit" type="submit" loading={submitting}>
              {MESSAGES.newProjectSubmit}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Dialog>
  );
}
