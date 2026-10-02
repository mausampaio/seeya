/**
 * D-052 (V2-T69): the "End day…" dialog's own hook — owns `state/end-day-panel.ts#reduceEndDayPanel`
 * via `useReducer` and wires the three IPC round trips (`endDayPreview`/`endDayRun`/
 * `onEndDayProgress`) into it. Mirrors `renderer/features/sidebar/SidebarFooter/
 * useSidebarFooter.ts`'s own split: the reducer decides, this hook only feeds it clicks and
 * responses and applies them back — never a DOM touch (D-052 item 2).
 *
 * Mounted once, inside `SidebarFooter` (next to the `#end-day-button` trigger and the Snooze
 * `Menu`, the same "owns its own popover" shape that component already has) — `SidebarFooter`
 * itself lives for the life of the window, so `onEndDayProgress`'s own listener (no unsubscribe —
 * `main/preload.ts`'s own `SeeyaApi` never gave this particular channel one, unlike
 * `onScheduleUpdate`/`onDaemonAvailabilityUpdate`) never needs cleanup either.
 */
import { useCallback, useEffect, useReducer, useRef } from 'preact/hooks';
import { getSeeyaApi } from '../../ipc/client.js';
import { reduceEndDayPanel, type EndDayPanelState } from '../../../state/end-day-panel.js';
import { refreshTodayPanel } from '../../legacy/today-panel-view.js';
import { openOrFocusPageTab } from '../tabs/index.js';

export interface EndDayControls {
  readonly state: EndDayPanelState;
  /** `SidebarFooter`'s own `#end-day-button` calls this one, always — it starts a fresh preview
   * from `idle`, or simply reopens whatever is already showing underneath otherwise (hidden
   * `running`/`result`), so the footer never has to know the state machine's own phases
   * (`docs/INTERFACE.md` § 6 item 2's own "permite reabrir"). */
  readonly triggerClicked: () => void;
  readonly cancel: () => void;
  readonly run: () => void;
  readonly hide: () => void;
  readonly closeResult: () => void;
  /** "Open Today" (the result view's own primary action) — closes the dialog AND focuses the
   * Today tab, same `openOrFocusPageTab` the sidebar's own Today card uses. */
  readonly openToday: () => void;
}

export function useEndDay(): EndDayControls {
  const api = getSeeyaApi();
  const [state, dispatch] = useReducer(reduceEndDayPanel, { kind: 'idle' } as EndDayPanelState);
  // A click into `open()` reads `stateRef.current` instead of the `state` this render closed
  // over — every handler below is a stable `useCallback` with an EMPTY dependency array (the
  // reducer's own guards, e.g. "openClicked from anywhere but idle is a no-op", only work if the
  // handler always checks the LATEST state, not a stale one captured at mount).
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // No unsubscribe function exists for this channel (see this module's own docstring) —
    // `SidebarFooter` mounts for the life of the window, the same justification
    // `SettingsDialog.tsx` already gives for its own always-mounted lifetime.
    api.onEndDayProgress((event) => {
      if (event.kind === 'started') {
        // `event.index`/`event.total` (the engine's own `sessionsInScope` count) are deliberately
        // not forwarded — `state/end-day-panel.ts#handleSessionStarted` computes its own `index`/
        // `total` from the narrower tracked list it seeds from the preview (PO review round 1,
        // V2-T69 item 2).
        dispatch({ kind: 'sessionStarted', sessionId: event.sessionId, name: event.name });
      } else {
        dispatch({ kind: 'sessionFinished', sessionId: event.sessionId, outcome: event.outcome });
      }
    });
  }, [api]);

  const open = useCallback(() => {
    if (stateRef.current.kind !== 'idle') {
      return;
    }
    dispatch({ kind: 'openClicked' });
    void api.endDayPreview().then((response) => {
      // The person may have cancelled WHILE the preview was in flight (V2-T5a's own original
      // guard, preserved) — a stale response must not resurrect a dialog they already dismissed
      // (D-025: only apply what's still relevant).
      if (stateRef.current.kind !== 'previewPending') {
        return;
      }
      dispatch({ kind: 'previewReady', ...response });
    });
  }, [api]);

  const cancel = useCallback(() => dispatch({ kind: 'cancelled' }), []);

  const run = useCallback(() => {
    if (stateRef.current.kind !== 'preview') {
      return;
    }
    dispatch({ kind: 'runClicked' });
    void api.endDayRun().then((response) => {
      dispatch({ kind: 'runFinished', ...response });
      void refreshTodayPanel();
    });
  }, [api]);

  const hide = useCallback(() => dispatch({ kind: 'hidden' }), []);
  const closeResult = useCallback(() => dispatch({ kind: 'closed' }), []);
  const openToday = useCallback(() => {
    dispatch({ kind: 'closed' });
    openOrFocusPageTab('today');
  }, []);

  const triggerClicked = useCallback(() => {
    if (stateRef.current.kind === 'idle') {
      open();
    } else {
      dispatch({ kind: 'reopened' });
    }
  }, [open]);

  return { state, triggerClicked, cancel, run, hide, closeResult, openToday };
}
