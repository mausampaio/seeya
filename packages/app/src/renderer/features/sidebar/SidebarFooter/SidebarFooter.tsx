/**
 * D-052 (V2-T75): the lateral's own footer (`docs/INTERFACE.md` § 1 item 7) — schedule strip,
 * "End day…", the daemon pill, and autostart. Replaces
 * `renderer/legacy/schedule-strip-view.ts`/`daemon-control-view.ts` entirely (deleted by this
 * task); `renderer/legacy/end-day-dialog-view.ts`/`autostart-control-view.ts` stay legacy-owned
 * (`docs/INTERFACE.md`'s own "Cuidados: autostart continua no rodapé até a V2-T65") — this
 * component renders only the stable anchor elements (`#end-day-button`, `#autostart-control-button`,
 * `#autostart-control-result`) those two modules already attach to by id, unchanged, never a
 * bound `onClick`/reactive text for them (`NavList.tsx`'s own docstring has the same reasoning:
 * a legacy module toggles these on every push of its own, not just once).
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
import { Menu } from '../../../components/Menu/index.js';
import { Text } from '../../../components/Text/index.js';
import { ChevronDownIcon, ClockIcon, PlayIcon, StopIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { useSidebarFooter } from './useSidebarFooter.js';

const SNOOZE_OPTIONS: readonly [15 | 30 | 60, string][] = [
  [15, MESSAGES.scheduleStripSnooze15],
  [30, MESSAGES.scheduleStripSnooze30],
  [60, MESSAGES.scheduleStripSnooze1h],
];

const SNOOZE_MENU_ITEMS = SNOOZE_OPTIONS.map(([minutes, label]) => ({
  value: String(minutes),
  label,
}));

export function SidebarFooter(): JSX.Element {
  const { schedule, onSnooze, onSkip, daemon, onDaemonControlClicked } = useSidebarFooter();
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const snoozeTriggerRef = useRef<HTMLButtonElement>(null);

  const running = daemon.availability.kind === 'stop';
  const unknown = daemon.availability.kind === 'unknown';
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
                    items={SNOOZE_MENU_ITEMS}
                    onSelect={handleSnoozeSelect}
                    onRequestClose={() => setSnoozeMenuOpen(false)}
                  />
                </GridItem>
              )}
              {schedule.canSkip && (
                <GridItem span={1}>
                  <Button variant="secondary" size="sm" fullWidth onClick={onSkip}>
                    {MESSAGES.scheduleStripSkipToday}
                  </Button>
                </GridItem>
              )}
            </Grid>
          )}
        </div>

        <Button id="end-day-button" size="sm" fullWidth>
          {MESSAGES.endDayButton}
        </Button>

        <div class={daemonPillClassName}>
          <span class={cx(styles, 'daemonDot')} aria-hidden="true" />
          <Text as="span" variant="body-sm" weight={500} className={cx(styles, 'daemonLabel')}>
            {daemonLabel}
          </Text>
          <IconButton
            id="daemon-control-button"
            variant="ghost"
            disabled={unknown}
            aria-label={daemonButtonLabel}
            onClick={onDaemonControlClicked}
          >
            {running ? <StopIcon /> : <PlayIcon />}
          </IconButton>
        </div>
        {daemon.kind === 'result' && <p class={cx(styles, 'daemonResult')}>{daemon.resultText}</p>}

        {/* Legacy-owned anchors — see this component's own docstring. */}
        <Button id="autostart-control-button" variant="secondary" size="sm" hidden>
          {MESSAGES.autostartControlEnable}
        </Button>
        <p id="autostart-control-result" class={cx(styles, 'autostartResult')} />
      </Stack>
    </Surface>
  );
}
