/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): "Rodapé fixo da aba: `N selected`, `Clear selection` e
 * `Resume selected` (desabilitado sem seleção, com o motivo)." Replaces the bare, always-enabled
 * `<button>` `renderer/legacy/today-panel-view.ts#renderTodayPanel` used to render.
 *
 * `disabledReason` tells the two disabled cases apart, computed by `Today.tsx` (D-041: this
 * component only lays the fact out, never decides it): every row already `runningNow`
 * (`MESSAGES.todayAllSessionsRunning`) vs. resumable rows exist but none are checked yet
 * (`MESSAGES.todaySelectNoneReason`).
 *
 * @example
 * <SelectionFooter selectedCount={2} resuming={false} disabledReason={undefined}
 *   onClearSelection={clear} onResumeSelected={resumeSelected} />
 */
import type { JSX } from 'preact';
import styles from './SelectionFooter.module.css';
import { cx } from '../../../components/css-class.js';
import { Surface } from '../../../components/Surface/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';

export interface SelectionFooterProps {
  readonly selectedCount: number;
  readonly resuming: boolean;
  readonly disabledReason: string | undefined;
  readonly onClearSelection: () => void;
  readonly onResumeSelected: () => void;
}

export function SelectionFooter(props: SelectionFooterProps): JSX.Element {
  const resumeDisabled = props.selectedCount === 0;
  return (
    <Surface padding="sm" bordered className={cx(styles, 'footer')}>
      <Stack direction="horizontal" align="center" justify="between" gap="sm">
        <Text as="span" variant="body-sm" tone="secondary">
          {MESSAGES.todaySelectionCount(props.selectedCount)}
        </Text>
        <Stack direction="horizontal" align="center" gap="sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={props.selectedCount === 0 || props.resuming}
            onClick={props.onClearSelection}
          >
            {MESSAGES.todayClearSelection}
          </Button>
          <Button
            id="today-resume-selected-button"
            size="sm"
            disabled={resumeDisabled}
            loading={props.resuming}
            disabledReason={resumeDisabled ? props.disabledReason : undefined}
            onClick={props.onResumeSelected}
          >
            {MESSAGES.todayResumeSelected}
          </Button>
        </Stack>
      </Stack>
    </Surface>
  );
}
