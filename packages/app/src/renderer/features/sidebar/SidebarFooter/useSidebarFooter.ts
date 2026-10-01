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
import { useCallback, useEffect, useRef, useState, useReducer } from 'preact/hooks';
import { getSeeyaApi } from '../../../ipc/client.js';
import type { ScheduleUpdateEvent } from '../../../../ipc/channels.js';
import {
  reduceDaemonControl,
  type DaemonControlState,
} from '../../../../state/daemon-control-panel.js';

const NO_SCHEDULE_YET: ScheduleUpdateEvent = {
  primary: '',
  secondary: '',
  canSnooze: false,
  canSkip: false,
};

const INITIAL_DAEMON_CONTROL_STATE: DaemonControlState = {
  kind: 'idle',
  availability: { kind: 'unknown' },
};

/** Which of the footer's own two schedule actions is in flight — `null` when neither is, D-024
 * (never two separate booleans that could both read `true` at once: the two actions both rewrite
 * the SAME `estado.json`, so this hook only ever lets one run at a time, see `onSnooze`/`onSkip`
 * below). */
export type ScheduleActionPending = 'snooze' | 'skip' | null;

export interface SidebarFooterControls {
  readonly schedule: ScheduleUpdateEvent;
  readonly scheduleActionPending: ScheduleActionPending;
  readonly onSnooze: (minutes: 15 | 30 | 60) => void;
  readonly onSkip: () => void;
  readonly daemon: DaemonControlState;
  readonly onDaemonControlClicked: () => void;
}

export function useSidebarFooter(): SidebarFooterControls {
  const api = getSeeyaApi();
  const [schedule, setSchedule] = useState<ScheduleUpdateEvent>(NO_SCHEDULE_YET);
  const [scheduleActionPending, setScheduleActionPending] = useState<ScheduleActionPending>(null);
  // Bug fix (maintainer-found, V2-T65-estado-na-tela item 2): this used to be a plain
  // `useIpcSubscription` call, which only exposes the push-driven VALUE, never a way to apply a
  // RESULT back into it — `onSnooze`/`onSkip` below need exactly that (their own `snoozeToday`/
  // `skipToday` IPC calls already return the freshly recomputed strip, `ipc/channels.ts`'s own
  // docstring on both channels says so — the bug was that nothing ever used the answer, same shape
  // as the `void api.getProjectsPanel();` defect `useIpcSubscription`'s own docstring already
  // documents, just on a MUTATING call this time instead of a read). Managed here instead, with
  // the identical "push always wins over a late-resolving fetch" guard (`receivedPushRef`) that
  // hook already has — `fetchInitial`'s one-time seed on mount is the only piece reused by name.
  const receivedPushRef = useRef(false);
  useEffect(() => {
    const unsubscribe = api.onScheduleUpdate((event) => {
      receivedPushRef.current = true;
      setSchedule(event);
    });
    void api.getScheduleStrip().then((result) => {
      if (!receivedPushRef.current) {
        setSchedule(result);
      }
    });
    return unsubscribe;
  }, [api]);
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

  // V2-T75 PO review (round 3): the SAME first-paint fix as `schedule` above, new in this round —
  // `getDaemonAvailability` seeds the pill before the first ambient tick, instead of leaving
  // `INITIAL_DAEMON_CONTROL_STATE`'s own "unknown" showing for up to two refresh intervals.
  // `reduceDaemonControl`'s own `availabilityUpdated` case is already safe against this resolving
  // after a click started a real command (`state.kind === 'running'` short-circuits it, same as a
  // push landing mid-command) — no extra guard needed here.
  useEffect(() => {
    void api.getDaemonAvailability().then((availability) => {
      dispatch({ kind: 'availabilityUpdated', availability });
    });
  }, [api]);

  // Bug fix (maintainer-found, V2-T65-estado-na-tela item 2): both actions used to fire the IPC
  // call and throw the response away (`void api.snoozeToday(...)`/`void api.skipToday()`) — the
  // maintainer clicked Skip and nothing happened until an UNRELATED re-render (or up to
  // `REFRESH_INTERVAL_MS` for the next ambient `scheduleUpdate` push) made the footer catch up.
  // `snoozeToday`/`skipToday` already return the freshly recomputed strip for exactly this reason
  // (`ipc/channels.ts`'s own docstring on both channels) — `setSchedule(response)` is the one-line
  // fix, `scheduleActionPending` is the "estado de trabalho" the maintainer's own follow-up asked
  // for as a `Button`'s own `loading` prop, never a second, separate spinner mechanism.
  const onSnooze = useCallback(
    (minutes: 15 | 30 | 60) => {
      if (scheduleActionPending !== null) {
        return;
      }
      setScheduleActionPending('snooze');
      void api.snoozeToday({ minutes }).then((response) => {
        setSchedule(response);
        setScheduleActionPending(null);
      });
    },
    [api, scheduleActionPending],
  );
  const onSkip = useCallback(() => {
    if (scheduleActionPending !== null) {
      return;
    }
    setScheduleActionPending('skip');
    void api.skipToday().then((response) => {
      setSchedule(response);
      setScheduleActionPending(null);
    });
  }, [api, scheduleActionPending]);

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

  return {
    schedule,
    scheduleActionPending,
    onSnooze,
    onSkip,
    daemon,
    onDaemonControlClicked,
  };
}
