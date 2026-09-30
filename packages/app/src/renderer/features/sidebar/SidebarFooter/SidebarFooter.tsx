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
 * @example
 * <SidebarFooter/>
 */
import type { JSX } from 'preact';
import styles from './SidebarFooter.module.css';
import { cx, mergeClassName } from '../../../components/css-class.js';
import { Button } from '../../../components/Button/index.js';
import { IconButton } from '../../../components/IconButton/index.js';
import { PlayIcon, StopIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { useSidebarFooter } from './useSidebarFooter.js';

const SNOOZE_OPTIONS: readonly [15 | 30 | 60, string][] = [
  [15, MESSAGES.scheduleStripSnooze15],
  [30, MESSAGES.scheduleStripSnooze30],
  [60, MESSAGES.scheduleStripSnooze1h],
];

export function SidebarFooter(): JSX.Element {
  const { schedule, onSnooze, onSkip, daemon, onDaemonControlClicked } = useSidebarFooter();

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

  return (
    <div class={cx(styles, 'footer')}>
      <div>
        <p class={cx(styles, 'scheduleText')}>{schedule.text}</p>
        {(schedule.canSnooze || schedule.canSkip) && (
          <div class={cx(styles, 'scheduleActions')}>
            {schedule.canSnooze && (
              <select
                aria-label={MESSAGES.scheduleStripSnoozeMenuLabel}
                value=""
                onChange={(event) => {
                  const minutes = Number((event.target as HTMLSelectElement).value);
                  (event.target as HTMLSelectElement).value = '';
                  if (minutes === 15 || minutes === 30 || minutes === 60) {
                    onSnooze(minutes);
                  }
                }}
              >
                <option value="" disabled hidden>
                  {MESSAGES.scheduleStripSnoozeMenuLabel}
                </option>
                {SNOOZE_OPTIONS.map(([minutes, label]) => (
                  <option key={minutes} value={minutes}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {schedule.canSkip && (
              <Button variant="secondary" size="sm" onClick={onSkip}>
                {MESSAGES.scheduleStripSkipToday}
              </Button>
            )}
          </div>
        )}
      </div>

      <Button id="end-day-button" fullWidth>
        {MESSAGES.endDayButton}
      </Button>

      <div class={daemonPillClassName}>
        <span class={cx(styles, 'daemonDot')} aria-hidden="true" />
        <span class={cx(styles, 'daemonLabel')}>{daemonLabel}</span>
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
      <Button id="autostart-control-button" variant="secondary" hidden>
        {MESSAGES.autostartControlEnable}
      </Button>
      <p id="autostart-control-result" class={cx(styles, 'autostartResult')} />
    </div>
  );
}
