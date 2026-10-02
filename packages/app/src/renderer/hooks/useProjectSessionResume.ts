/**
 * V2-T77 (`docs/INTERFACE.md` § 5a): `Resume` on one of a PROJECT's own sessions — shared by the
 * Projects tab (the expanded row's session list) and the Sessions tab (`projectResume` rows), so
 * the two can never disagree about what a click does, how it shows progress, or how a refusal is
 * reported.
 *
 * Calls `CHANNELS.resumeProjectSession`, which runs the project's own `open` pipeline
 * (`main/project-ipc.ts`) — never the simple `resumeSession`, which skips the lock, the hooks and
 * the questions. Same two shapes as the `Open` button (`useProjects.ts`'s own top docstring):
 *
 * - **`pending`** clears on WHICHEVER comes first — the harness tab opening (`resumeTabOpened`,
 *   whose `label` is the project id, the signal that matters: the call itself only resolves when
 *   the tab eventually CLOSES, possibly hours later) or the call settling (a refusal, a declined
 *   question, which resolve at once and open no tab).
 * - **A refusal is never silent** (`docs/INTERFACE.md` § 5a: "falha nunca em silêncio"): every
 *   settled call, including a rejection, leaves a `result` the tab shows until dismissed or the next
 *   attempt starts. Unlike a plain `Open` click (no result area, Q-105), a resume can be refused for
 *   a reason the person must be able to read — the session is running, or not in this project.
 */
import { useCallback, useEffect, useState } from 'preact/hooks';
import { getSeeyaApi } from '../ipc/client.js';

export interface ProjectSessionResumeResult {
  /** `true` when the session was resumed (the call only settles after its tab closed). */
  readonly resumed: boolean;
  readonly text: string;
}

export interface ProjectSessionResumeControls {
  readonly resume: (projectId: string, sessionId: string) => void;
  readonly isPending: (sessionId: string) => boolean;
  readonly result: ProjectSessionResumeResult | null;
  readonly dismissResult: () => void;
}

export function useProjectSessionResume(): ProjectSessionResumeControls {
  const api = getSeeyaApi();
  // sessionId → the project it is being resumed into (the tab event only carries the project id).
  const [pending, setPending] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [result, setResult] = useState<ProjectSessionResumeResult | null>(null);

  const clearPendingFor = useCallback(
    (matches: (sessionId: string, projectId: string) => boolean) => {
      setPending((previous) => {
        const next = new Map(
          [...previous].filter(([sessionId, projectId]) => !matches(sessionId, projectId)),
        );
        return next.size === previous.size ? previous : next;
      });
    },
    [],
  );

  useEffect(() => {
    api.onResumeTabOpened((event) =>
      clearPendingFor((_sessionId, projectId) => projectId === event.label),
    );
  }, [api, clearPendingFor]);

  const resume = useCallback(
    (projectId: string, sessionId: string) => {
      setResult(null);
      setPending((previous) => new Map(previous).set(sessionId, projectId));
      void api.resumeProjectSession({ projectId, sessionId }).then(
        (response) => {
          clearPendingFor((id) => id === sessionId);
          setResult({ resumed: response.resumed, text: response.outcomeText });
        },
        (error: unknown) => {
          clearPendingFor((id) => id === sessionId);
          const reason = error instanceof Error ? error.message : String(error);
          setResult({ resumed: false, text: `Could not resume the session: ${reason}` });
        },
      );
    },
    [api, clearPendingFor],
  );

  const isPending = useCallback((sessionId: string) => pending.has(sessionId), [pending]);
  const dismissResult = useCallback(() => setResult(null), []);

  return { resume, isPending, result, dismissResult };
}
