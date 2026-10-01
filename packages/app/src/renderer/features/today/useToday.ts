/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): the Today tab's own data and actions — the real
 * replacement for `renderer/legacy/today-panel-view.ts` (apagado by this task).
 *
 * **Why selection never needs the legacy panel's snapshot/restore dance.** The old DOM-at-hand
 * panel rebuilt `#today-panel` from scratch on every `onTodayUpdate` push, so it had to snapshot
 * which checkboxes were checked and which "Resume in" directory was chosen BEFORE rebuilding, then
 * restore them after (`today-panel-view.ts#renderTodayPanelPreservingSelections`) — otherwise a
 * refresh tick landing between "person checks a box" and "person clicks Resume selected" would
 * silently uncheck it. Here, `selectedSessionIds`/`chosenCwdBySessionId` are hook state, entirely
 * separate from `data` (also hook state) — a `data` push updates ONE piece of state, never
 * touching the other two, so there is nothing to snapshot or restore. `resumableSelection`
 * (`state/today-panel.ts`) is the only pruning a stale selected id (one that stopped offering a
 * checkbox on a later tick) ever needs, applied fresh every render.
 *
 * **Why `resumeSelected` re-fetches `getTodayPanel` itself, rather than waiting for the next
 * ambient push.** `CHANNELS.resumeSelected`'s own handler (`main/main.ts`) never pushes a fresh
 * `todayUpdate` — it only returns the `ResumeSummaryResponse`. The legacy panel called
 * `refreshTodayPanel()` (a second `getTodayPanel` invoke) right after, for the exact same reason:
 * without it, a just-resumed session would keep showing its checkbox until the next ambient
 * refresh tick, up to `REFRESH_INTERVAL_MS` later.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getSeeyaApi } from '../../ipc/client.js';
import type { ResumeProgressUpdateEvent, ResumeSummaryResponse } from '../../../ipc/channels.js';
import {
  hasResumableSession,
  resumableSelection,
  type TodayPanelData,
} from '../../../state/today-panel.js';

const NO_BRIEFING_YET: TodayPanelData = { kind: 'noBriefing', message: '' };

export interface TodayControls {
  readonly data: TodayPanelData;
  readonly selectedSessionIds: ReadonlySet<string>;
  readonly toggleSession: (sessionId: string, checked: boolean) => void;
  readonly chosenCwdBySessionId: ReadonlyMap<string, string>;
  readonly setChosenCwd: (sessionId: string, cwd: string) => void;
  readonly clearSelection: () => void;
  readonly selectedCount: number;
  /** Whether at least one row in `data.rows` still offers the checkbox at all — `false` here means
   * every row is already `runningNow`, the `docs/INTERFACE.md`-named case the "Resume selected"
   * button's own `disabledReason` tells apart from "resumable, but nothing checked yet". */
  readonly hasResumable: boolean;
  readonly resuming: boolean;
  readonly progress: ResumeProgressUpdateEvent | null;
  readonly result: ResumeSummaryResponse | null;
  readonly resumeSelected: () => void;
}

export function useToday(): TodayControls {
  const api = getSeeyaApi();
  const [data, setData] = useState<TodayPanelData>(NO_BRIEFING_YET);
  const receivedPushRef = useRef(false);
  useEffect(() => {
    const unsubscribe = api.onTodayUpdate((event) => {
      receivedPushRef.current = true;
      setData(event);
    });
    // `useIpcSubscription`'s own "fetchInitial" fix, inlined here rather than reused directly —
    // this hook also needs a bare `refetch` for `resumeSelected` below, which that shared hook has
    // no way to expose (it only ever returns the latest VALUE, never a function to pull a fresh
    // one on demand).
    void api.getTodayPanel().then((result) => {
      if (!receivedPushRef.current) {
        setData(result);
      }
    });
    return unsubscribe;
  }, [api]);

  const [selectedSessionIds, setSelectedSessionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [chosenCwdBySessionId, setChosenCwdBySessionId] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [resuming, setResuming] = useState(false);
  const [progress, setProgress] = useState<ResumeProgressUpdateEvent | null>(null);
  const [result, setResult] = useState<ResumeSummaryResponse | null>(null);

  useEffect(() => {
    api.onResumeProgress(setProgress);
    // `onResumeProgress` has no unsubscribe of its own (`main/preload.ts`'s own docstring: only
    // the six `onXUpdate` methods do) — harmless here, same "mounts once for the life of the
    // window" guarantee every other such listener in this app already relies on (`<Today/>` is
    // mounted once, inside the Today page pane, for the life of the window).
  }, [api]);

  const toggleSession = useCallback((sessionId: string, checked: boolean) => {
    setSelectedSessionIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return next;
    });
  }, []);

  const setChosenCwd = useCallback((sessionId: string, cwd: string) => {
    setChosenCwdBySessionId((previous) => new Map(previous).set(sessionId, cwd));
  }, []);

  const clearSelection = useCallback(() => setSelectedSessionIds(new Set()), []);

  const rows = data.kind === 'pending' ? data.rows : [];
  const selection = resumableSelection(rows, selectedSessionIds);

  const resumeSelected = useCallback(() => {
    if (data.kind !== 'pending' || resuming || selection.length === 0) {
      return;
    }
    setResuming(true);
    setProgress(null);
    setResult(null);
    const chosenCwdForRequest: Record<string, string> = {};
    for (const sessionId of selection) {
      const chosen = chosenCwdBySessionId.get(sessionId);
      if (chosen !== undefined) {
        chosenCwdForRequest[sessionId] = chosen;
      }
    }
    void api
      .resumeSelected({
        day: data.day,
        sessionIds: selection,
        chosenCwdBySessionId: chosenCwdForRequest,
      })
      .then(async (response) => {
        setResult(response);
        setProgress(null);
        setSelectedSessionIds(new Set());
        // See this file's own top docstring for why a second fetch, not a wait for the next push.
        const fresh = await api.getTodayPanel();
        setData(fresh);
        setResuming(false);
      });
  }, [api, data, resuming, selection, chosenCwdBySessionId]);

  return {
    data,
    selectedSessionIds,
    toggleSession,
    chosenCwdBySessionId,
    setChosenCwd,
    clearSelection,
    selectedCount: selection.length,
    hasResumable: hasResumableSession(rows),
    resuming,
    progress,
    result,
    resumeSelected,
  };
}
