/**
 * The leftover-uncommitted-changes-from-a-previous-session confirmation (V2-T71,
 * `docs/INTERFACE.md` § 9 — "Mudanças pendentes de outra sessão: a lista de arquivos (M/A, com
 * rolagem se longa); `Continue without committing` e `Commit now`, cada um explicado"). Replaces
 * `renderer/legacy/project-leftover-changes-confirm-dialog-view.ts`/the static `<Dialog
 * id="leftover-changes-confirm-dialog">` anchor (both apagados by this task).
 *
 * Uses `Dialog`'s own `footer` prop (the same pinned-header/pinned-footer/scrolling-body shape
 * `EndDayDialog` already established) so a long file list scrolls WITHOUT pushing the two buttons
 * below the window's own bottom edge — exactly the "com rolagem se longa" the spec asks for.
 *
 * @example
 * <LeftoverChangesConfirmDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './LeftoverChangesConfirmDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { StatusList, type StatusListItem } from '../../../components/StatusList/index.js';
import type { Tone } from '../../../components/props.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import { formatChangedFileStatusLetter } from '../../../../state/changed-file-row.js';
import type {
  ChangedFileDisplayStatus,
  ChangedFileRow,
  ConfirmLeftoverChangesOpenRequestEvent,
} from '../../../../ipc/channels.js';

type Decision = 'commitNow' | 'proceedWithoutCommitting';

const TONE_BY_STATUS: Readonly<Record<ChangedFileDisplayStatus, Tone>> = {
  added: 'success',
  modified: 'info',
  deleted: 'error',
  renamed: 'neutral',
  other: 'neutral',
};

function toStatusListItem(row: ChangedFileRow): StatusListItem {
  return {
    id: row.path,
    title: row.path,
    badges: [
      { label: formatChangedFileStatusLetter(row.status), tone: TONE_BY_STATUS[row.status] },
    ],
  };
}

export function LeftoverChangesConfirmDialog(): JSX.Element {
  const [request, setRequest] = useState<ConfirmLeftoverChangesOpenRequestEvent | null>(null);

  useEffect(() => {
    getSeeyaApi().onConfirmLeftoverChangesOpenRequest((event) => setRequest(event));
  }, []);

  function answer(decision: Decision): void {
    if (request === null) {
      return;
    }
    getSeeyaApi().answerLeftoverChangesOpenConfirm({ requestId: request.requestId, decision });
    setRequest(null);
  }

  // Escape proceeds WITHOUT committing — the same "closing without an explicit choice never
  // destroys or auto-commits anything" default `renderer/legacy/
  // project-leftover-changes-confirm-dialog-view.ts` already established (the leftover changes
  // themselves stay on disk either way; only the COMMIT is the thing an escape must never trigger
  // by accident).
  function handleClose(): void {
    answer('proceedWithoutCommitting');
  }

  return (
    <Dialog
      id="leftover-changes-confirm-dialog"
      title={request === null ? undefined : MESSAGES.leftoverChangesConfirmTitle(request.projectId)}
      open={request !== null}
      onClose={handleClose}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="leftover-changes-confirm-proceed"
            variant="secondary"
            onClick={() => answer('proceedWithoutCommitting')}
          >
            {MESSAGES.leftoverChangesConfirmProceed}
          </Button>
          <Button id="leftover-changes-confirm-commit" onClick={() => answer('commitNow')}>
            {MESSAGES.leftoverChangesConfirmCommit}
          </Button>
        </>
      }
    >
      {request !== null && (
        <Stack gap="md">
          <Text as="p" variant="body-md">
            {MESSAGES.leftoverChangesConfirmContext(request.changedFiles.length)}
          </Text>
          <StatusList
            items={request.changedFiles.map(toStatusListItem)}
            emptyMessage={MESSAGES.endDayNothingToShow}
          />
          <Stack gap="xs">
            <Text as="p" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.leftoverChangesConfirmProceed}:</strong>{' '}
              {MESSAGES.leftoverChangesConfirmProceedExplanation}
            </Text>
            <Text as="p" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.leftoverChangesConfirmCommit}:</strong>{' '}
              {MESSAGES.leftoverChangesConfirmCommitExplanation}
            </Text>
          </Stack>
        </Stack>
      )}
    </Dialog>
  );
}
