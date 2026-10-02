/**
 * The "revert this adoption?" confirmation (V2-T83, `docs/INTERFACE.md` § 4a/§ 9) — asked by
 * `revertAdoption` itself once it has planned the revert and knows how many commits it would undo
 * (so the count is the engine's, not a guess the window makes up front). Title says the fact, one
 * context line says the size, each option is explained, the primary is on the right. Escape
 * cancels: closing without choosing never reverts anything.
 *
 * Same "mounted once in `App.tsx`, the pending request IS the open state" shape as
 * `ProjectLockConfirmDialog`.
 *
 * @example
 * <RevertAdoptionConfirmDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './RevertAdoptionConfirmDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import type { ConfirmRevertAdoptionRequestEvent } from '../../../../ipc/channels.js';

type Decision = 'proceed' | 'decline';

export function RevertAdoptionConfirmDialog(): JSX.Element {
  const [request, setRequest] = useState<ConfirmRevertAdoptionRequestEvent | null>(null);

  useEffect(() => {
    getSeeyaApi().onConfirmRevertAdoptionRequest((event) => setRequest(event));
  }, []);

  function answer(decision: Decision): void {
    if (request === null) {
      return;
    }
    getSeeyaApi().answerRevertAdoptionConfirm({ requestId: request.requestId, decision });
    setRequest(null);
  }

  return (
    <Dialog
      id="revert-adoption-confirm-dialog"
      title={request === null ? undefined : MESSAGES.confirmRevertTitle(request.projectId)}
      open={request !== null}
      onClose={() => answer('decline')}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="revert-adoption-confirm-decline"
            variant="secondary"
            onClick={() => answer('decline')}
          >
            {MESSAGES.confirmRevertDecline}
          </Button>
          <Button id="revert-adoption-confirm-proceed" onClick={() => answer('proceed')}>
            {MESSAGES.confirmRevertProceed}
          </Button>
        </>
      }
    >
      {request !== null && (
        <Stack gap="md">
          <Text as="div" variant="body-md" id="revert-adoption-confirm-context">
            {MESSAGES.confirmRevertContextCommits(request.commitCount)}
          </Text>
          <Stack gap="xs">
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmRevertDecline}:</strong>{' '}
              {MESSAGES.confirmRevertDeclineExplanation}
            </Text>
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmRevertProceed}:</strong>{' '}
              {MESSAGES.confirmRevertProceedExplanation}
            </Text>
          </Stack>
        </Stack>
      )}
    </Dialog>
  );
}
