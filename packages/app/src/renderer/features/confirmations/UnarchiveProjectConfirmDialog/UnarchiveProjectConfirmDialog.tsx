/**
 * The "unarchive this project?" question (V2-T84, `docs/INTERFACE.md` § 4b/§ 9) an archived row's
 * `Unarchive…` opens: it never blocks and never opens a project in silence — two outcomes, each
 * explained, plus `Cancel`: `Unarchive` (the project comes back, nothing opens) and `Unarchive and
 * open` (the same, then the ordinary `openProject` — its own lock/leftover questions follow as they
 * always do). The engine call happens here, with `loading` on the clicked button and any refusal
 * (a project locked by another session, say) shown inside the dialog, never swallowed.
 *
 * @example
 * <UnarchiveProjectConfirmDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './UnarchiveProjectConfirmDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import type { ProjectActionResponse } from '../../../../state/project-details-result.js';
import {
  registerUnarchiveConfirmOpener,
  type ProjectConfirmTarget,
} from '../archive-confirm-bridge.js';

/** D-024: which button is running — never two booleans that could both be true. */
type Pending = 'unarchive' | 'unarchiveAndOpen' | null;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function UnarchiveProjectConfirmDialog(): JSX.Element {
  const [target, setTarget] = useState<ProjectConfirmTarget | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [problem, setProblem] = useState<ProjectActionResponse | null>(null);

  useEffect(() => {
    registerUnarchiveConfirmOpener((next) => {
      setTarget(next);
      setPending(null);
      setProblem(null);
    });
  }, []);

  async function choose(choice: Exclude<Pending, null>): Promise<void> {
    if (target === null || pending !== null) {
      return;
    }
    setPending(choice);
    setProblem(null);
    try {
      const api = getSeeyaApi();
      const response = await api.unarchiveProject({ projectId: target.projectId });
      if (response.tone === 'error') {
        setProblem(response);
        return;
      }
      setTarget(null);
      if (choice === 'unarchiveAndOpen') {
        // Not awaited: `openProject` resolves only when the tab closes (`CHANNELS.openProject`'s
        // own docstring) — the tab appears through `resumeTabOpened`, and a refusal of the open
        // itself is that flow's own dialog/result, not this one's.
        void api.openProject({ projectId: target.projectId }).catch(() => undefined);
      }
    } catch (error: unknown) {
      setProblem({
        tone: 'error',
        lines: [MESSAGES.projectDetailsActionError(describeError(error))],
        projectRemoved: false,
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog
      id="unarchive-project-confirm-dialog"
      title={target === null ? undefined : MESSAGES.confirmUnarchiveTitle(target.name)}
      open={target !== null}
      onClose={() => setTarget(null)}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="unarchive-project-confirm-decline"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => setTarget(null)}
          >
            {MESSAGES.confirmUnarchiveDecline}
          </Button>
          <Button
            id="unarchive-project-confirm-proceed"
            variant="secondary"
            loading={pending === 'unarchive'}
            disabled={pending !== null}
            onClick={() => void choose('unarchive')}
          >
            {MESSAGES.confirmUnarchiveProceed}
          </Button>
          <Button
            id="unarchive-project-confirm-open"
            loading={pending === 'unarchiveAndOpen'}
            disabled={pending !== null}
            onClick={() => void choose('unarchiveAndOpen')}
          >
            {MESSAGES.confirmUnarchiveAndOpen}
          </Button>
        </>
      }
    >
      {target !== null && (
        <Stack gap="md">
          <Text as="div" variant="body-md" id="unarchive-project-confirm-context">
            {MESSAGES.confirmUnarchiveContextLine}
          </Text>
          <Stack gap="xs">
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmUnarchiveProceed}:</strong>{' '}
              {MESSAGES.confirmUnarchiveProceedExplanation}
            </Text>
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmUnarchiveAndOpen}:</strong>{' '}
              {MESSAGES.confirmUnarchiveAndOpenExplanation}
            </Text>
            <Text as="div" variant="body-sm" tone="secondary">
              <strong>{MESSAGES.confirmUnarchiveDecline}:</strong>{' '}
              {MESSAGES.confirmUnarchiveDeclineExplanation}
            </Text>
          </Stack>
          {problem !== null && (
            <InfoBox tone="error">
              <Stack gap="xs">
                {problem.lines.map((line) => (
                  <Text
                    key={line}
                    as="div"
                    variant="body-sm"
                    id="unarchive-project-confirm-problem"
                  >
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
