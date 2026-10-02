/**
 * D-052 (V2-T75): the lateral's own footer (`docs/INTERFACE.md` § 1 item 7) — schedule strip,
 * "End day…", and the daemon pill. Replaces `renderer/legacy/schedule-strip-view.ts`/
 * `daemon-control-view.ts` entirely (deleted by that task).
 *
 * V2-T69: "End day…" is a real, reactive button now (`renderer/features/end-day/`), replacing
 * `renderer/legacy/end-day-dialog-view.ts`'s own `#end-day-button` stable anchor (apagado by this
 * task) — `useEndDay()` is owned HERE, not inside `<EndDayDialog/>` itself, because the trigger
 * button's own label needs to reflect the dialog's state even while it's hidden
 * (`describeEndDayFooterLabel`, `docs/INTERFACE.md` § 6 item 2's own "o rodapé... permite
 * reabrir") — the same "owns its own popover" shape this component already has for the Snooze
 * `Menu`.
 *
 * V2-T65 (`docs/INTERFACE.md`'s own "o botão de autostart sai do rodapé da lateral"): the
 * autostart anchor this component used to render for `renderer/legacy/autostart-control-view.ts`
 * (apagado by that task) is gone — the switch moved to Settings' own General section
 * (`renderer/features/settings/GeneralSection/`).
 *
 * PO review (2026-10-01), `docs/INTERFACE.md` § 1 item 7:
 * - The schedule line is now an icon + two-text row (`ClockIcon`, `primary` at weight 500,
 *   `secondary` in tertiary tone) instead of one flat string — `state/schedule-strip.ts` decides
 *   the words, this component only lays them out.
 * - Snooze is a `Button` + `ChevronDownIcon` opening a `Menu` (`+15m`/`+30m`/`+1h`), replacing the
 *   earlier unstyled native `<select>`. Snooze/Skip sit side by side with EQUAL width via `Grid`
 *   (two columns, one `GridItem` each) — never raw flexbox `flex: 1` at the call site.
 * - End day/Snooze/Skip/autostart all render at `size="sm"` now (`Button`'s own `body-sm`,
 *   D-052 item 7) — before this they were three different sizes (`md` for End day/autostart,
 *   `sm` for Skip, the native `<select>`'s own UA font for Snooze).
 *
 * @example
 * <SidebarFooter/>
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import styles from './SidebarFooter.module.css';
import { cx, mergeClassName } from '../../../components/css-class.js';
import { Surface } from '../../../components/Surface/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { Grid, GridItem } from '../../../components/Grid/index.js';
import { Button } from '../../../components/Button/index.js';
import { IconButton } from '../../../components/IconButton/index.js';
import { Menu, type MenuItem } from '../../../components/Menu/index.js';
import { Text } from '../../../components/Text/index.js';
import { ChevronDownIcon, ClockIcon, PlayIcon, StopIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { UndoSnoozeControl } from '../../../../state/schedule-strip.js';
import { describeEndDayFooterLabel } from '../../../../state/end-day-panel.js';
import { EndDayDialog, useEndDay } from '../../end-day/index.js';
import { useSidebarFooter } from './useSidebarFooter.js';

const SNOOZE_OPTIONS: readonly [15 | 30 | 60, string][] = [
  [15, MESSAGES.scheduleStripSnooze15],
  [30, MESSAGES.scheduleStripSnooze30],
  [60, MESSAGES.scheduleStripSnooze1h],
];

const SNOOZE_MENU_ITEMS: readonly MenuItem[] = SNOOZE_OPTIONS.map(([minutes, label]) => ({
  value: String(minutes),
  label,
}));

const UNDO_SNOOZE_VALUE = 'undo';

/** V2-T50: "Undo snooze" below a divider — it is an action over the choices above it, not one of
 * them. Absent when there is nothing to undo; disabled with the reason once the configured time
 * has passed (D-006 amendment of 2026-09-24). */
function buildSnoozeMenuItems(undo: UndoSnoozeControl): readonly MenuItem[] {
  switch (undo.kind) {
    case 'hidden':
      return SNOOZE_MENU_ITEMS;
    case 'available':
      return [
        ...SNOOZE_MENU_ITEMS,
        {
          value: UNDO_SNOOZE_VALUE,
          label: MESSAGES.scheduleStripUndoSnooze,
          separatorBefore: true,
        },
      ];
    case 'disabled':
      return [
        ...SNOOZE_MENU_ITEMS,
        {
          value: UNDO_SNOOZE_VALUE,
          label: MESSAGES.scheduleStripUndoSnooze,
          separatorBefore: true,
          disabledReason: undo.reason,
        },
      ];
  }
}

export function SidebarFooter(): JSX.Element {
  const {
    schedule,
    scheduleActionPending,
    onSnooze,
    onSkip,
    onUndoSnooze,
    daemon,
    onDaemonControlClicked,
  } = useSidebarFooter();
  const endDay = useEndDay();
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const snoozeTriggerRef = useRef<HTMLButtonElement>(null);

  const running = daemon.availability.kind === 'stop';
  const unknown = daemon.availability.kind === 'unknown';
  const daemonBusy = daemon.kind === 'running';
  const daemonLabel = unknown
    ? MESSAGES.daemonControlUnknown
    : running
      ? MESSAGES.daemonPillRunning
      : MESSAGES.daemonPillStopped;
  const daemonPillClassName = mergeClassName(
    cx(styles, 'daemonPill', running ? 'daemonPillSuccess' : 'daemonPillNeutral'),
  );
  const daemonButtonLabel = running
    ? MESSAGES.daemonControlStopAction
    : MESSAGES.daemonControlStartAction;

  function handleSnoozeSelect(value: string): void {
    if (value === UNDO_SNOOZE_VALUE) {
      onUndoSnooze();
      return;
    }
    const minutes = Number(value);
    if (minutes === 15 || minutes === 30 || minutes === 60) {
      onSnooze(minutes);
    }
  }

  return (
    <Surface padding="sm" bordered={false} className={cx(styles, 'footerDivider')}>
      <Stack gap="sm">
        <div>
          <div class={cx(styles, 'scheduleRow')}>
            <ClockIcon size={14} class={cx(styles, 'scheduleIcon')} />
            <Text
              as="span"
              variant="caption"
              weight={500}
              truncate
              className={cx(styles, 'schedulePrimary')}
            >
              {schedule.primary}
            </Text>
            <Text
              as="span"
              variant="caption"
              tone="tertiary"
              className={cx(styles, 'scheduleSecondary')}
            >
              {schedule.secondary}
            </Text>
          </div>
          {(schedule.canSnooze || schedule.canSkip) && (
            <Grid columns={2} gap="sm" className={cx(styles, 'scheduleActions')}>
              {schedule.canSnooze && (
                <GridItem span={1}>
                  <Button
                    id="schedule-strip-snooze-button"
                    variant="secondary"
                    size="sm"
                    fullWidth
                    loading={scheduleActionPending === 'snooze' || scheduleActionPending === 'undo'}
                    disabled={scheduleActionPending === 'skip'}
                    buttonRef={snoozeTriggerRef}
                    onClick={() => setSnoozeMenuOpen((open) => !open)}
                  >
                    <span class={cx(styles, 'snoozeTriggerContent')}>
                      {MESSAGES.scheduleStripSnoozeMenuLabel}
                      <ChevronDownIcon size={14} />
                    </span>
                  </Button>
                  <Menu
                    id="schedule-strip-snooze-menu"
                    open={snoozeMenuOpen}
                    anchorRef={snoozeTriggerRef}
                    ariaLabel={MESSAGES.scheduleStripSnoozeMenuLabel}
                    items={buildSnoozeMenuItems(schedule.undoSnooze)}
                    onSelect={handleSnoozeSelect}
                    onRequestClose={() => setSnoozeMenuOpen(false)}
                  />
                </GridItem>
              )}
              {schedule.canSkip && (
                <GridItem span={1}>
                  <Button
                    id="schedule-strip-skip-button"
                    variant="secondary"
                    size="sm"
                    fullWidth
                    loading={scheduleActionPending === 'skip'}
                    disabled={
                      scheduleActionPending === 'snooze' || scheduleActionPending === 'undo'
                    }
                    onClick={onSkip}
                  >
                    {MESSAGES.scheduleStripSkipToday}
                  </Button>
                </GridItem>
              )}
            </Grid>
          )}
        </div>

        <Button id="end-day-button" size="sm" fullWidth onClick={endDay.triggerClicked}>
          {describeEndDayFooterLabel(endDay.state)}
        </Button>
        <EndDayDialog controls={endDay} />

        <div class={daemonPillClassName}>
          <span class={cx(styles, 'daemonDot')} aria-hidden="true" />
          <Text as="span" variant="body-sm" weight={500} className={cx(styles, 'daemonLabel')}>
            {daemonLabel}
          </Text>
          <IconButton
            id="daemon-control-button"
            variant="ghost"
            disabled={unknown}
            loading={daemonBusy}
            aria-label={daemonButtonLabel}
            onClick={onDaemonControlClicked}
          >
            {running ? <StopIcon /> : <PlayIcon />}
          </IconButton>
        </div>
        {daemon.kind === 'result' && (
          <Text as="p" variant="caption" tone="secondary" className={cx(styles, 'daemonResult')}>
            {daemon.resultText}
          </Text>
        )}
      </Stack>
    </Surface>
  );
}
