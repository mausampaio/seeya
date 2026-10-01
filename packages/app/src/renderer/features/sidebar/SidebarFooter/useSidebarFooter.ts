/**
 * D-052 (V2-T75): the lateral's own footer — schedule strip and daemon pill (`docs/INTERFACE.md`
 * § 1 item 7) — replaces `renderer/legacy/schedule-strip-view.ts`/`daemon-control-view.ts`
 * (superseded by this feature, deleted by this task). Autostart stays legacy-imperative
 * (`SidebarFooter.tsx`'s own docstring) — this hook owns none of it.
 *
 * Reuses the SAME pure reducers the deleted legacy views already had
 * (`state/daemon-control-panel.ts#reduceDaemonControl`) — only the DOM-touching half moves into a
 * hook, never the decision itself.
 */
import { useCallback, useEffect, useReducer } from 'preact/hooks';
import { getSeeyaApi } from '../../../ipc/client.js';
import { useIpcSubscription } from '../../../hooks/useIpcSubscription.js';
import type { ScheduleUpdateEvent } from '../../../../ipc/channels.js';
import {
  reduceDaemonControl,
  type DaemonControlState,
} from '../../../../state/daemon-control-panel.js';

const NO_SCHEDULE_YET: ScheduleUpdateEvent = { text: '', canSnooze: false, canSkip: false };

const INITIAL_DAEMON_CONTROL_STATE: DaemonControlState = {
  kind: 'idle',
  availability: { kind: 'unknown' },
};

export interface SidebarFooterControls {
  readonly schedule: ScheduleUpdateEvent;
  readonly onSnooze: (minutes: 15 | 30 | 60) => void;
  readonly onSkip: () => void;
  readonly daemon: DaemonControlState;
  readonly onDaemonControlClicked: () => void;
}

export function useSidebarFooter(): SidebarFooterControls {
  const api = getSeeyaApi();
  // Wrapped in an arrow function — see `useSidebar.ts`'s own comment on the identical fix.
  const schedule = useIpcSubscription<ScheduleUpdateEvent>(
    (listener) => api.onScheduleUpdate(listener),
    NO_SCHEDULE_YET,
  );
  const [daemon, dispatch] = useReducer(reduceDaemonControl, INITIAL_DAEMON_CONTROL_STATE);

  // A plain `useEffect`, not `useIpcSubscription`: that hook mirrors a channel into `useState`,
  // but the daemon pill's state is a REDUCER (`reduceDaemonControl`) so a push and a click's own
  // response fold through the exact same transitions — `reduceDaemonControl`'s own docstring: a
  // refresh landing WHILE a command is running must not re-enable the button, which only holds if
  // both event sources dispatch into the one reducer.
  useEffect(
    () =>
      api.onDaemonAvailabilityUpdate((availability) => {
        dispatch({ kind: 'availabilityUpdated', availability });
      }),
    [api],
  );

  const onSnooze = useCallback(
    (minutes: 15 | 30 | 60) => {
      void api.snoozeToday({ minutes });
    },
    [api],
  );
  const onSkip = useCallback(() => {
    void api.skipToday();
  }, [api]);

  const onDaemonControlClicked = useCallback(() => {
    if (
      (daemon.kind !== 'idle' && daemon.kind !== 'result') ||
      daemon.availability.kind === 'unknown'
    ) {
      return;
    }
    const action = daemon.availability.kind === 'start' ? 'start' : 'stop';
    dispatch({ kind: 'clicked' });
    void api.daemonControl({ action }).then((response) => {
      dispatch({
        kind: 'finished',
        resultText: response.resultText,
        availability: response.availability,
      });
    });
  }, [api, daemon]);

  return { schedule, onSnooze, onSkip, daemon, onDaemonControlClicked };
}
