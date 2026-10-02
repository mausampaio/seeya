/**
 * The "archive this project?" confirmation (V2-T84, `docs/INTERFACE.md` § 4b/§ 9): the project's
 * NAME in the title, what changes (it leaves Favorites, Recent and the default list; its sessions
 * stay and End day still captures them), what does NOT (nothing is deleted, and it can be
 * unarchived), and the optional one-line note. Two explained outcomes, `Archive` on the right as the
 * primary; Escape cancels.
 *
 * The call to the engine happens HERE (not in the dialog that opened this one): the button shows
 * `loading`, the response is applied at once (the Projects panel is re-pushed by the main process,
 * so the Project details dialog behind this one re-reads itself), and anything other than success
 * — the engine's refusal for a locked project, "already archived", a rejected IPC call — stays on
 * screen inside the dialog instead of vanishing (never a silent failure).
 *
 * @example
 * <ArchiveProjectConfirmDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './ArchiveProjectConfirmDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import { TextField } from '../../../components/TextField/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import type { ProjectActionResponse } from '../../../../state/project-details-result.js';
import {
  registerArchiveConfirmOpener,
  type ProjectConfirmTarget,
} from '../archive-confirm-bridge.js';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ArchiveProjectConfirmDialog(): JSX.Element {
  const [target, setTarget] = useState<ProjectConfirmTarget | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ProjectActionResponse | null>(null);

  useEffect(() => {
    registerArchiveConfirmOpener((next) => {
      setTarget(next);
      setNote('');
      setPending(false);
      setProblem(null);
    });
  }, []);

  async function confirm(): Promise<void> {
    if (target === null || pending) {
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      const trimmed = note.trim();
      const response = await getSeeyaApi().archiveProject({
        projectId: target.projectId,
        note: trimmed === '' ? null : trimmed,
      });
      if (response.tone === 'success') {
        setTarget(null);
      } else {
        setProblem(response);
      }
    } catch (error: unknown) {
      setProblem({
        tone: 'error',
        lines: [MESSAGES.projectDetailsActionError(describeError(error))],
        projectRemoved: false,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      id="archive-project-confirm-dialog"
      title={target === null ? undefined : MESSAGES.confirmArchiveTitle(target.name)}
      open={target !== null}
      onClose={() => setTarget(null)}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="archive-project-confirm-decline"
            variant="secondary"
            disabled={pending}
            onClick={() => setTarget(null)}
          >
            {MESSAGES.confirmArchiveDecline}
          </Button>
          <Button
            id="archive-project-confirm-proceed"
            loading={pending}
            onClick={() => void confirm()}
          >
            {MESSAGES.confirmArchiveProceed}
          </Button>
        </>
      }
    >
      {target !== null && (
        <Stack gap="md">
          <Stack gap="xs">
            <Text as="div" variant="body-md" id="archive-project-confirm-changes">
              {MESSAGES.confirmArchiveChangesLine}
            </Text>
            <Text as="div" variant="body-md" id="archive-project-confirm-nothing-deleted">
              {MESSAGES.confirmArchiveNothingDeletedLine}
            </Text>
          </Stack>
          <TextField
            id="archive-project-note-input"
            label={MESSAGES.confirmArchiveNoteLabel}
            placeholder={MESSAGES.confirmArchiveNotePlaceholder}
            value={note}
            disabled={pending}
            onInput={setNote}
          />
          <Stack gap="xs">
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmArchiveDecline}:</strong>{' '}
              {MESSAGES.confirmArchiveDeclineExplanation}
            </Text>
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmArchiveProceed}:</strong>{' '}
              {MESSAGES.confirmArchiveProceedExplanation}
            </Text>
          </Stack>
          {problem !== null && (
            <InfoBox tone={problem.tone === 'error' ? 'error' : 'info'}>
              <Stack gap="xs">
                {problem.lines.map((line) => (
                  <Text key={line} as="div" variant="body-sm" id="archive-project-confirm-problem">
                    {line}
                  </Text>
                ))}
              </Stack>
            </InfoBox>
          )}
        </Stack>
      )}
    </Dialog>
  );
}
