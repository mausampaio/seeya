/**
 * The resume-fallback confirmation (V2-T71, `docs/INTERFACE.md` § 9 — "Retomada que não deu como
 * estava: o motivo e as saídas como cartões explicados (`Resume without the plan` recomendado
 * quando existe); `Skip this one`, `Open a fresh session`, `Resume without the plan`"). Replaces
 * `renderer/legacy/fallback-dialog-view.ts`/the static `<Dialog id="fallback-dialog">` anchor
 * (both apagados by this task) — same `FallbackConfirmRequestEvent`/`answerFallbackConfirm` IPC
 * shape (`core/resume-fallback-decision.ts#FallbackDecision`'s own three answers, V2-T7), only the
 * presentation changes.
 *
 * Three OUTCOME cards, never a Cancel/primary footer pair — these are peer choices, not a
 * destructive-action-needs-confirming shape, so each card carries its own button instead of one
 * being "the" primary at the dialog's own edge. `offersResumeWithoutPlan` (`promptTooLarge` only,
 * V2-T7 item 4) decides whether the third card renders at all and whether it carries the
 * `Recommended` chip — the fixed left-to-right order from `docs/INTERFACE.md` § 9 itself never
 * changes, so "the primary reads right-most" still holds without any reordering.
 *
 * @example
 * <ResumeFallbackDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import styles from './ResumeFallbackDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button, type ButtonVariant } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { Surface } from '../../../components/Surface/index.js';
import { Chip } from '../../../components/Chip/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import type { FallbackConfirmRequestEvent } from '../../../../ipc/channels.js';

type Decision = 'open' | 'resumeWithoutPlan' | 'skip';

interface OutcomeCardProps {
  readonly id: string;
  readonly title: string;
  readonly explanation: string;
  readonly buttonLabel: string;
  readonly variant: ButtonVariant;
  readonly recommended?: boolean;
  readonly onSelect: () => void;
}

function OutcomeCard(props: OutcomeCardProps): JSX.Element {
  return (
    <Surface padding="md" radius="md" className={cx(styles, 'card')}>
      <Stack gap="sm">
        <Stack direction="horizontal" justify="between" align="center">
          <Text as="h4" variant="heading-4">
            {props.title}
          </Text>
          {props.recommended === true && (
            <Chip tone="brand" size="sm">
              {MESSAGES.fallbackCardRecommended}
            </Chip>
          )}
        </Stack>
        <Text as="p" variant="body-sm" tone="secondary">
          {props.explanation}
        </Text>
        <Button id={props.id} variant={props.variant} fullWidth onClick={props.onSelect}>
          {props.buttonLabel}
        </Button>
      </Stack>
    </Surface>
  );
}

export function ResumeFallbackDialog(): JSX.Element {
  const [request, setRequest] = useState<FallbackConfirmRequestEvent | null>(null);

  useEffect(() => {
    getSeeyaApi().onConfirmFallbackRequest((event) => setRequest(event));
  }, []);

  function answer(decision: Decision): void {
    if (request === null) {
      return;
    }
    getSeeyaApi().answerFallbackConfirm({ requestId: request.requestId, decision });
    setRequest(null);
  }

  // V2-T7's own per-reason default: closing without choosing (Escape) resumes without the plan
  // when that's offered at all (the new default, mirroring the CLI's blank-answer default for the
  // same reason), skips otherwise — `resumeFailed` has no free option to fall back to.
  function handleClose(): void {
    answer(request?.offersResumeWithoutPlan === true ? 'resumeWithoutPlan' : 'skip');
  }

  const context: ComponentChildren = request !== null && (
    <Text as="p" variant="body-sm" tone="secondary">
      {request.reasonText} ({request.cwd})
    </Text>
  );

  return (
    <Dialog
      id="fallback-dialog"
      title={request === null ? undefined : MESSAGES.fallbackDialogTitle(request.sessionName)}
      open={request !== null}
      onClose={handleClose}
      className={cx(styles, 'dialog')}
    >
      {request !== null && (
        <Stack gap="md">
          {context}
          <Stack gap="sm" className={cx(styles, 'cardsScroll')}>
            <OutcomeCard
              id="fallback-dialog-skip"
              title={MESSAGES.fallbackCardSkipTitle}
              explanation={MESSAGES.fallbackCardSkipExplanation}
              buttonLabel={MESSAGES.fallbackDialogSkip}
              variant="secondary"
              onSelect={() => answer('skip')}
            />
            <OutcomeCard
              id="fallback-dialog-open"
              title={MESSAGES.fallbackCardOpenTitle}
              explanation={MESSAGES.fallbackDialogBody(false)}
              buttonLabel={MESSAGES.fallbackDialogOpen}
              variant="secondary"
              onSelect={() => answer('open')}
            />
            {request.offersResumeWithoutPlan && (
              <OutcomeCard
                id="fallback-dialog-resume-without-plan"
                title={MESSAGES.fallbackCardResumeWithoutPlanTitle}
                explanation={MESSAGES.fallbackDialogBody(true)}
                buttonLabel={MESSAGES.fallbackDialogResumeWithoutPlan}
                variant="primary"
                recommended
                onSelect={() => answer('resumeWithoutPlan')}
              />
            )}
          </Stack>
        </Stack>
      )}
    </Dialog>
  );
}
