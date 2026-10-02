/**
 * The project-lock read-only-open confirmation (V2-T71, `docs/INTERFACE.md` § 9 — "Projeto
 * travado: quem segura o lock e desde quando; `Cancel` e `Open read-only`"). Replaces
 * `renderer/legacy/project-lock-confirm-dialog-view.ts`/the static `<Dialog
 * id="project-lock-confirm-dialog">` anchor in `renderer/legacy/dialogs-shell.tsx` (both apagados
 * by this task) — a real reactive `Dialog` (`open`/`onClose`, the same `SettingsDialog`/
 * `NewProjectDialog` pattern) instead of `document.getElementById(...).showModal()` by id.
 *
 * Mounted once, directly in `App.tsx` (the same "mounts once for the life of the window, driven
 * by its own IPC subscription" shape every other confirmation dialog in this folder shares) — the
 * pending request IS the component's own open/closed state (`request !== null`), never a second,
 * independent boolean a push event and a click could disagree about.
 *
 * @example
 * <ProjectLockConfirmDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './ProjectLockConfirmDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import { formatLockHolderLine } from '../../../../state/project-lock-confirm.js';
import type { ConfirmProjectLockOpenRequestEvent } from '../../../../ipc/channels.js';

type Decision = 'proceed' | 'decline';

export function ProjectLockConfirmDialog(): JSX.Element {
  const [request, setRequest] = useState<ConfirmProjectLockOpenRequestEvent | null>(null);

  // Registered once — the real implementation is in place before `main/project-ipc.ts` could
  // possibly send a request, the same "mounts once, listener is live first" guarantee every other
  // `onConfirm*Request` consumer in this window already relies on.
  useEffect(() => {
    getSeeyaApi().onConfirmProjectLockOpenRequest((event) => setRequest(event));
  }, []);

  function answer(decision: Decision): void {
    if (request === null) {
      return;
    }
    getSeeyaApi().answerProjectLockOpenConfirm({ requestId: request.requestId, decision });
    setRequest(null);
  }

  // Escape (the dialog's own native "cancel"/"close" event) declines — the same "closing without
  // choosing is the safe answer" default every confirmation dialog in this package follows.
  function handleClose(): void {
    answer('decline');
  }

  return (
    <Dialog
      id="project-lock-confirm-dialog"
      title={request === null ? undefined : MESSAGES.projectLockConfirmTitle(request.projectId)}
      open={request !== null}
      onClose={handleClose}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="project-lock-confirm-decline"
            variant="secondary"
            onClick={() => answer('decline')}
          >
            {MESSAGES.projectLockConfirmDecline}
          </Button>
          <Button id="project-lock-confirm-proceed" onClick={() => answer('proceed')}>
            {MESSAGES.projectLockConfirmProceed}
          </Button>
        </>
      }
    >
      {request !== null && (
        <Stack gap="md">
          {/* PO review, round 1: the context line shows the SHORT session id (same scheme the
           * Projects tab's own lock column already uses, `formatLockHolderLine`'s own docstring)
           * — the full id never disappears, it moves to this line's own `title` (a hover
           * tooltip), the same "short text, full fact on hover" shape `shortenDirectoryPath`
           * already established for a truncated path. */}
          <Text
            as="p"
            variant="body-md"
            id="project-lock-confirm-context"
            title={request.heldBySessionId ?? undefined}
          >
            {formatLockHolderLine(request)}
          </Text>
          <Stack gap="xs">
            <Text as="p" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.projectLockConfirmDecline}:</strong>{' '}
              {MESSAGES.projectLockConfirmDeclineExplanation}
            </Text>
            <Text as="p" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.projectLockConfirmProceed}:</strong>{' '}
              {MESSAGES.projectLockConfirmProceedExplanation}
            </Text>
          </Stack>
        </Stack>
      )}
    </Dialog>
  );
}
