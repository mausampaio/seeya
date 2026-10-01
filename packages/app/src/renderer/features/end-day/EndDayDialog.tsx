/**
 * D-052 (V2-T69, `docs/INTERFACE.md` § 6): the "End day…" dialog — preview, progress and result,
 * switched on `state/end-day-panel.ts#EndDayPanelState.kind`. Replaces
 * `renderer/legacy/end-day-dialog-view.ts` entirely (apagado by this task): a real reactive
 * component, built on `Dialog`'s own `open`/`onClose` (the same pattern `SettingsDialog.tsx`
 * already established) instead of `document.getElementById('end-day-dialog').showModal()` by id.
 *
 * Mounted once, inside `SidebarFooter` (`useEndDay.ts`'s own docstring explains why) — `open` is
 * governed by the phase itself (`isDialogOpen` below), never a separate prop a parent has to keep
 * in sync: `idle` has nothing to show, `previewPending`/`preview`/`starting` are always visible
 * once started (Hide doesn't exist yet at those phases, `docs/INTERFACE.md` § 6), and
 * `running`/`result` carry their own `visible` flag Hide/the footer's reopen toggle (D-052's own
 * "estado sempre no reducer, nunca espalhado").
 *
 * **What the native `close` event (Esc included) means differs by phase** (`handleClose` below):
 * cancelling an unstarted preview really does throw it away ("fechar sem escolher é cancelar",
 * V2-T5a); once "Run end-day now" has been clicked, the real capture is already happening in the
 * background with no cancellation path (`application/end-day.ts` has none) — Esc there can only
 * ever mean Hide, never a lie about having stopped anything.
 */
import type { JSX } from 'preact';
import styles from './EndDayDialog.module.css';
import { cx } from '../../components/css-class.js';
import { Dialog } from '../../components/Dialog/index.js';
import { Text } from '../../components/Text/index.js';
import { MESSAGES } from '../../../text/messages.js';
import { PreviewPane } from './PreviewPane/index.js';
import { ProgressPane } from './ProgressPane/index.js';
import { ResultPane } from './ResultPane/index.js';
import type { EndDayControls } from './useEndDay.js';

export interface EndDayDialogProps {
  readonly controls: EndDayControls;
}

function isDialogOpen(state: EndDayControls['state']): boolean {
  if (state.kind === 'idle') {
    return false;
  }
  if (state.kind === 'running' || state.kind === 'result') {
    return state.visible;
  }
  return true;
}

export function EndDayDialog(props: EndDayDialogProps): JSX.Element {
  const { controls } = props;
  const { state } = controls;

  function handleClose(): void {
    if (state.kind === 'previewPending' || state.kind === 'preview') {
      controls.cancel();
      return;
    }
    if (state.kind === 'result') {
      controls.closeResult();
      return;
    }
    // `starting`/`running`: the real capture is already in flight, so closing the dialog can only
    // ever mean Hide — see this file's own docstring.
    controls.hide();
  }

  return (
    <Dialog
      id="end-day-dialog"
      title={MESSAGES.endDayDialogTitle}
      open={isDialogOpen(state)}
      onClose={handleClose}
      className={cx(styles, 'dialog')}
    >
      {state.kind === 'previewPending' && (
        <Text as="p" variant="body-md">
          {MESSAGES.endDayDialogLoadingPreview}
        </Text>
      )}
      {(state.kind === 'preview' || state.kind === 'starting') && (
        <PreviewPane
          data={state}
          starting={state.kind === 'starting'}
          onCancel={controls.cancel}
          onRun={controls.run}
        />
      )}
      {state.kind === 'running' && (
        <ProgressPane sessions={state.sessions} current={state.current} onHide={controls.hide} />
      )}
      {state.kind === 'result' && (
        <ResultPane
          captured={state.captured}
          failed={state.failed}
          skipped={state.skipped}
          onOpenToday={controls.openToday}
          onClose={controls.closeResult}
        />
      )}
    </Dialog>
  );
}
