/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): one session card in the Today tab — "caixa de marcar,
 * nome, id curto, diretório (mono) e a primeira linha do plano", in the three named states:
 *
 * - `neverResumed`: a plain `Checkbox` wrapping the whole content block (clicking anywhere on the
 *   card toggles it — native `<label>` behaviour, `Checkbox.module.css`'s own docstring on why
 *   that's safe even with a nested `Select` inside `CwdChangeNotice`).
 * - `resumedEarlier`: the same `Checkbox`, with the `Resumed earlier · closed` chip trailing the
 *   name row.
 * - `runningNow`: no checkbox at all — a `CheckIcon` ("ícone de concluído") in its place, and the
 *   `Running now · open in a tab` chip trailing the name row. Not wrapped in a `<label>` (there is
 *   nothing to toggle), so clicking the card does nothing — `docs/INTERFACE.md` never asks for a
 *   click action here.
 *
 * Replaces `renderer/legacy/today-panel-view.ts#renderTodaySessionRow` (apagado by this task).
 *
 * @example
 * <SessionCard row={row} checked={selected.has(row.sessionId)} disabled={resuming}
 *   chosenCwd={chosenCwdBySessionId.get(row.sessionId)}
 *   onToggle={toggleSession} onChooseCwd={setChosenCwd} />
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './SessionCard.module.css';
import { cx } from '../../../components/css-class.js';
import { Surface } from '../../../components/Surface/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { Chip } from '../../../components/Chip/index.js';
import { Checkbox } from '../../../components/Checkbox/index.js';
import { CheckIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { TodaySessionRow } from '../../../../state/today-panel.js';
import { CwdChangeNotice } from '../CwdChangeNotice/index.js';

export interface SessionCardProps {
  readonly row: TodaySessionRow;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly chosenCwd: string | undefined;
  readonly onToggle: (sessionId: string, checked: boolean) => void;
  readonly onChooseCwd: (sessionId: string, cwd: string) => void;
}

/** The content shared by all three states — name + id, directory, plan line, and the directory-
 * change notice when there's one to show. `trailing` is the status chip (`resumedEarlier`/
 * `runningNow`), `undefined` for `neverResumed` (nothing to say yet). */
function SessionCardBody(props: {
  readonly row: TodaySessionRow;
  readonly disabled: boolean;
  readonly chosenCwd: string | undefined;
  readonly onChooseCwd: (sessionId: string, cwd: string) => void;
  readonly trailing?: ComponentChildren;
}): JSX.Element {
  const { row } = props;
  return (
    <Stack gap="xs" className={cx(styles, 'body')}>
      <Stack direction="horizontal" justify="between" align="start" gap="sm">
        <Stack direction="horizontal" gap="xs" align="center" className={cx(styles, 'nameRow')}>
          <Text as="span" variant="body-sm" weight={500} truncate className={cx(styles, 'name')}>
            {row.name}
          </Text>
          <Text as="span" variant="code" tone="tertiary">
            {row.displaySessionId}
          </Text>
        </Stack>
        {props.trailing}
      </Stack>
      <Text as="p" variant="code" tone="secondary" truncate>
        {row.cwd}
      </Text>
      <Text as="p" variant="body-sm" tone={row.firstPlanLine === null ? 'tertiary' : 'secondary'}>
        {row.firstPlanLine ?? MESSAGES.todayNoPlanRecorded}
      </Text>
      {row.cwdHistory.length > 1 && (
        <CwdChangeNotice
          sessionId={row.sessionId}
          history={row.cwdHistory}
          chosenCwd={props.chosenCwd}
          disabled={props.disabled}
          onChooseCwd={props.onChooseCwd}
        />
      )}
    </Stack>
  );
}

export function SessionCard(props: SessionCardProps): JSX.Element {
  const { row } = props;

  if (row.resumeStatus.kind === 'runningNow') {
    return (
      <Surface padding="md" radius="md" className={cx(styles, 'card')}>
        <Stack direction="horizontal" gap="sm" align="start">
          <span class={cx(styles, 'statusIcon')} aria-hidden="true">
            <CheckIcon size={18} />
          </span>
          <SessionCardBody
            row={row}
            disabled={props.disabled}
            chosenCwd={props.chosenCwd}
            onChooseCwd={props.onChooseCwd}
            trailing={
              <Chip tone="success" variant="soft" size="sm">
                {MESSAGES.todayRunningNowChip}
              </Chip>
            }
          />
        </Stack>
      </Surface>
    );
  }

  return (
    <Surface padding="md" radius="md" className={cx(styles, 'card')}>
      <Checkbox
        id={`today-session-${row.sessionId}`}
        checked={props.checked}
        value={row.sessionId}
        disabled={props.disabled}
        className={cx(styles, 'checkbox')}
        onChange={(checked) => props.onToggle(row.sessionId, checked)}
        label={
          <SessionCardBody
            row={row}
            disabled={props.disabled}
            chosenCwd={props.chosenCwd}
            onChooseCwd={props.onChooseCwd}
            trailing={
              row.resumeStatus.kind === 'resumedEarlier' ? (
                <Chip tone="neutral" variant="outline" size="sm">
                  {MESSAGES.todayResumedEarlierChip}
                </Chip>
              ) : undefined
            }
          />
        }
      />
    </Surface>
  );
}
