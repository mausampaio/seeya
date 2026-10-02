/**
 * The "remove this project?" confirmation (V2-T83, `docs/INTERFACE.md` § 4a/§ 9): the project's
 * NAME in the title, how many files leave the workspace, and — the line that matters most —
 * what is NOT deleted (associated repositories, sessions, transcripts: `removeProject` never has
 * a path to reach any of them). The primary is the `error`-toned `Remove project`, on the right;
 * Escape cancels.
 *
 * @example
 * <RemoveProjectConfirmDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './RemoveProjectConfirmDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import type { ConfirmRemoveProjectRequestEvent } from '../../../../ipc/channels.js';

type Decision = 'proceed' | 'decline';

export function RemoveProjectConfirmDialog(): JSX.Element {
  const [request, setRequest] = useState<ConfirmRemoveProjectRequestEvent | null>(null);

  useEffect(() => {
    getSeeyaApi().onConfirmRemoveProjectRequest((event) => setRequest(event));
  }, []);

  function answer(decision: Decision): void {
    if (request === null) {
      return;
    }
    getSeeyaApi().answerRemoveProjectConfirm({ requestId: request.requestId, decision });
    setRequest(null);
  }

  return (
    <Dialog
      id="remove-project-confirm-dialog"
      title={request === null ? undefined : MESSAGES.confirmRemoveProjectTitle(request.name)}
      open={request !== null}
      onClose={() => answer('decline')}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="remove-project-confirm-decline"
            variant="secondary"
            onClick={() => answer('decline')}
          >
            {MESSAGES.confirmRemoveProjectDecline}
          </Button>
          <Button
            id="remove-project-confirm-proceed"
            tone="error"
            onClick={() => answer('proceed')}
          >
            {MESSAGES.confirmRemoveProjectProceed}
          </Button>
        </>
      }
    >
      {request !== null && (
        <Stack gap="md">
          <Stack gap="xs">
            <Text as="p" variant="body-md" id="remove-project-confirm-context">
              {MESSAGES.confirmRemoveProjectContext(request.fileCount)}
            </Text>
            <Text as="p" variant="body-md" id="remove-project-confirm-not-deleted">
              {MESSAGES.confirmRemoveProjectNotDeleted}
            </Text>
          </Stack>
          <Stack gap="xs">
            <Text as="p" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmRemoveProjectDecline}:</strong>{' '}
              {MESSAGES.confirmRemoveProjectDeclineExplanation}
            </Text>
            <Text as="p" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmRemoveProjectProceed}:</strong>{' '}
              {MESSAGES.confirmRemoveProjectProceedExplanation}
            </Text>
          </Stack>
        </Stack>
      )}
    </Dialog>
  );
}
