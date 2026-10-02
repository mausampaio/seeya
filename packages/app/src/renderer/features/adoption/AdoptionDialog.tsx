/**
 * V2-T70 (`docs/INTERFACE.md` § 7): the single adoption dialog — replaces the four separate
 * dialogs `renderer/legacy/adopt-flow-view.ts` used to show (apagado by this task). One `Dialog`,
 * whose body switches between `PickPane`/`ReviewPane`/`ResultPane` by `state.kind`, mirroring
 * `renderer/features/end-day/EndDayDialog.tsx`'s own "one state machine, one dialog, a `footer`
 * per phase" shape.
 *
 * Mounted once, directly by `App.tsx` (same lifetime as `<NewProjectDialog/>`) — opened from
 * OUTSIDE via `adoption-dialog-bridge.ts#openAdoptionDialog`, called by the Sessions tab's own
 * `Adopt…` button (`renderer/features/sessions/useSessions.ts`).
 *
 * **The dialog is CLOSED (`state.kind === 'launching'`) between submitting the picker and the
 * next push** — `state/adopt-panel.ts`'s own docstring has the full reasoning: a modal `<dialog>`
 * would block the very tab the fork session needs the person to work in.
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './AdoptionDialog.module.css';
import { cx } from '../../components/css-class.js';
import { Dialog } from '../../components/Dialog/index.js';
import { Button } from '../../components/Button/index.js';
import { Stack } from '../../components/Stack/index.js';
import { Text } from '../../components/Text/index.js';
import { MESSAGES } from '../../../text/messages.js';
import { PickPane } from './PickPane/index.js';
import { ReviewPane } from './ReviewPane/index.js';
import { ResultPane } from './ResultPane/index.js';
import { useAdoption, type AdoptionControls } from './useAdoption.js';

function isDialogOpen(state: AdoptionControls['state']): boolean {
  return state.kind === 'pickProject' || state.kind === 'commitConfirm' || state.kind === 'result';
}

function titleFor(state: AdoptionControls['state']): string {
  if (state.kind === 'commitConfirm') {
    return MESSAGES.adoptReviewTitle;
  }
  if (state.kind === 'result') {
    return MESSAGES.adoptResultTitle;
  }
  return MESSAGES.adoptPickTitle;
}

function footerFor(controls: AdoptionControls): ComponentChildren {
  const { state } = controls;
  if (state.kind === 'pickProject') {
    return (
      <>
        <Button id="adoption-pick-cancel-button" variant="secondary" onClick={controls.cancel}>
          {MESSAGES.adoptPickCancel}
        </Button>
        <Button
          id="adoption-pick-submit-button"
          loading={controls.submitting}
          onClick={controls.submit}
        >
          {MESSAGES.adoptPickSubmit}
        </Button>
      </>
    );
  }
  if (state.kind === 'commitConfirm') {
    // Same shape `LeftoverChangesConfirmDialog`/`ProjectLockConfirmDialog`/
    // `DaemonOwnershipTransitionDialog` (V2-T71, `docs/INTERFACE.md` § 9) already established:
    // each option's explanation lives IN the footer, full-width, stacked ABOVE a single
    // right-aligned button row — never two narrow columns each under its own button (that shape
    // pushed a shorter explanation's button out of line with the longer one's, the defect V2-T71's
    // own PO review round 1 found).
    return (
      <Stack gap="sm" className={cx(styles, 'footerStack')}>
        <Stack gap="xs">
          <Text as="p" variant="caption" tone="secondary">
            <strong>{MESSAGES.adoptReviewDiscard}:</strong> {MESSAGES.adoptReviewDiscardExplanation}
          </Text>
          <Text as="p" variant="caption" tone="secondary">
            <strong>{MESSAGES.adoptReviewCommit}:</strong> {MESSAGES.adoptReviewCommitExplanation}
          </Text>
        </Stack>
        <Stack direction="horizontal" gap="sm" justify="end">
          <Button
            id="adoption-review-discard-button"
            variant="secondary"
            onClick={() => controls.answerCommit('decline')}
          >
            {MESSAGES.adoptReviewDiscard}
          </Button>
          <Button
            id="adoption-review-commit-button"
            onClick={() => controls.answerCommit('commit')}
          >
            {MESSAGES.adoptReviewCommit}
          </Button>
        </Stack>
      </Stack>
    );
  }
  if (state.kind === 'result') {
    return (
      <>
        <Button
          id="adoption-result-close-button"
          variant="secondary"
          onClick={controls.closeResult}
        >
          {MESSAGES.adoptResultClose}
        </Button>
        {state.adopted && (
          <Button id="adoption-result-open-project-button" onClick={controls.closeResult}>
            {MESSAGES.adoptResultOpenProject}
          </Button>
        )}
      </>
    );
  }
  return undefined;
}

export function AdoptionDialog(): JSX.Element {
  const controls = useAdoption();
  const { state } = controls;

  function handleClose(): void {
    if (state.kind === 'pickProject') {
      controls.cancel();
      return;
    }
    if (state.kind === 'commitConfirm') {
      // Esc on the review step is the same as "Discard" — never a silent third option that
      // leaves the fork's own uncommitted changes in limbo (D-025).
      controls.answerCommit('decline');
      return;
    }
    controls.closeResult();
  }

  return (
    <Dialog
      id="adoption-dialog"
      title={titleFor(state)}
      open={isDialogOpen(state)}
      onClose={handleClose}
      className={cx(styles, 'dialog')}
      footer={footerFor(controls)}
    >
      {state.kind === 'pickProject' && <PickPane session={state.session} controls={controls} />}
      {state.kind === 'commitConfirm' && (
        <ReviewPane
          rows={controls.reviewRows}
          fileCount={state.entries.length}
          projectId={state.projectId}
        />
      )}
      {state.kind === 'result' && (
        <ResultPane
          outcomeText={state.outcomeText}
          adopted={state.adopted}
          homeDir={controls.homeDir}
          platformHint={controls.platformHint}
        />
      )}
    </Dialog>
  );
}
