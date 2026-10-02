/**
 * "Delete the adopted copy too?" (V2-T83, `docs/INTERFACE.md` § 4a/§ 9) — asked by `revertAdoption`
 * only when the copy kept writing after the adoption, or its transcript could not be found
 * (`application/project-revert-adoption.ts#resolveAdoptedCopy`). **`Keep` is the default**
 * (D-047 item 6: "resposta padrão é manter") — it is the primary button on the right, and Escape
 * keeps too: not acting is the safe side here, the one confirmation where the safe answer and the
 * primary button are the same.
 *
 * The question sentence is rendered by the main process (it needs the transcript's own last-write
 * time and size) with the CLI's own function, so both interfaces ask in the same words.
 *
 * @example
 * <DeleteAdoptedCopyConfirmDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './DeleteAdoptedCopyConfirmDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import type { ConfirmDeleteAdoptedCopyRequestEvent } from '../../../../ipc/channels.js';

type Decision = 'delete' | 'keep';

export function DeleteAdoptedCopyConfirmDialog(): JSX.Element {
  const [request, setRequest] = useState<ConfirmDeleteAdoptedCopyRequestEvent | null>(null);

  useEffect(() => {
    getSeeyaApi().onConfirmDeleteAdoptedCopyRequest((event) => setRequest(event));
  }, []);

  function answer(decision: Decision): void {
    if (request === null) {
      return;
    }
    getSeeyaApi().answerDeleteAdoptedCopyConfirm({ requestId: request.requestId, decision });
    setRequest(null);
  }

  return (
    <Dialog
      id="delete-adopted-copy-confirm-dialog"
      title={request === null ? undefined : MESSAGES.confirmDeleteCopyTitle}
      open={request !== null}
      onClose={() => answer('keep')}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="delete-adopted-copy-confirm-delete"
            variant="secondary"
            tone="error"
            onClick={() => answer('delete')}
          >
            {MESSAGES.confirmDeleteCopyDelete}
          </Button>
          <Button id="delete-adopted-copy-confirm-keep" onClick={() => answer('keep')}>
            {MESSAGES.confirmDeleteCopyKeep}
          </Button>
        </>
      }
    >
      {request !== null && (
        <Stack gap="md">
          <Text as="div" variant="body-md" id="delete-adopted-copy-confirm-context">
            {request.question}
          </Text>
          <Stack gap="xs">
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmDeleteCopyDelete}:</strong>{' '}
              {MESSAGES.confirmDeleteCopyDeleteExplanation}
            </Text>
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmDeleteCopyKeep}:</strong>{' '}
              {MESSAGES.confirmDeleteCopyKeepExplanation}
            </Text>
          </Stack>
        </Stack>
      )}
    </Dialog>
  );
}
