/**
 * V2-T9 item 1 — a session's history of directories it ran in, across days, built entirely from
 * this project's own captures (docs/PLANO-DE-ENTREGA.md V2-T9's own "a fonte, medida antes de
 * especificar"): the transcript's own per-line `cwd` doesn't serve (it's the shell's current
 * directory at every command, not where the session was launched — measured against a real
 * session with 32 distinct values), and the transcript folder's slug loses information too. **The
 * source is this project's own history of captures**: each day's handoff already records the
 * `cwd` the session was captured with, and walking that sequence backward is enough to notice a
 * change — no new key on disk, nothing this project doesn't already have.
 *
 * Two halves, same split `application/find-pending-briefing.ts` already draws between a pure
 * recorte and an I/O read: `collapseCwdRuns` below takes an already-ordered list of `{ day, cwd }`
 * samples and decides where the directory changed (pure, tested directly); `readCwdHistory` is
 * the I/O loop that produces that ordered list from `Storage.readHandoff` and then asks
 * `DirectoryExistence` whether each distinct directory it found still exists.
 */
import type { DirectoryExistence, Storage } from '../core/ports.js';
import type { Day } from '../core/types.js';
import { localDayString, subtractLocalDays } from '../core/day.js';
import { normalizeCwdForComparison, type PathPlatformHint } from '../core/cwd-normalization.js';

/**
 * One distinct directory in a session's history — a run of consecutive days the session was
 * captured with the SAME (normalized) `cwd`, collapsed into a single entry. `firstDay`/`lastDay`
 * are both the run's OWN days (never a neighboring run's) — a note built from this can say "until
 * `lastDay`" for an earlier run or "since `firstDay`" for the current one without the caller
 * having to reconstruct either boundary itself.
 *
 * `exists` is D-025 applied to a directory this project doesn't own (`core/ports.ts
 * #DirectoryExistence`'s own docstring): "not found" is stated, never hidden — an entry whose
 * directory is gone still appears here, with `exists: false`, rather than being silently dropped.
 */
export interface CwdHistoryEntry {
  readonly cwd: string;
  readonly firstDay: Day;
  readonly lastDay: Day;
  readonly exists: boolean;
}

/** One day's own capture, as far as this module cares — `readCwdHistory` builds these from
 * `Storage.readHandoff`; `collapseCwdRuns` never reads storage itself; the array it is handed must
 * already be in chronological (oldest-first) order. */
export interface CwdHistorySample {
  readonly day: Day;
  readonly cwd: string;
}

/**
 * The pure "recorte": given `samples` in chronological order (oldest first, one per day the
 * session was actually captured on — a day with no capture simply has no entry, never a gap
 * filled in), collapses consecutive days sharing the same (normalized) `cwd` into runs. Two
 * spellings of the same directory (a different separator, a different case on Windows, a trailing
 * slash) are the same run — `core/cwd-normalization.ts`, the same comparison S3-T5 already
 * established for `config.json`'s `ignore`/`projectPolicy` — but the run's OWN `cwd` keeps
 * whichever spelling was captured FIRST, so the history reads back exactly what the handoff
 * recorded, not a normalized stand-in nobody typed.
 *
 * `exists` is always `false` here — this function does no I/O at all; `readCwdHistory` below is
 * what fills it in for real, per distinct directory, after this function has already decided how
 * many distinct directories there are to check.
 *
 * **`platformHint` is a parameter, never read from `process.platform` here** — same reasoning
 * `core/cwd-normalization.ts`'s own docstring already gives for why `normalizeCwdForComparison`
 * takes it as a plain argument instead of reading the real OS: this keeps `collapseCwdRuns` pure
 * and lets both platform branches (case-folded on `'win32'`, not on `'posix'`) be exercised from
 * any CI runner, regardless of which OS actually runs the test (docs/QUESTOES.md Q-079: an
 * earlier version of this module read `process.platform` directly, which is why its own test for
 * "two spellings, different case" passed on Windows and failed on Linux — the module's real
 * behavior depended on which OS ran it, exactly the class of bug `core/cwd-normalization.ts`
 * exists to keep out of `core/`, now also kept out of this `application/` module). The two
 * composition roots (`packages/cli/src/composition.ts#buildStartDayContext`,
 * `packages/app/src/composition/index.ts#buildAppContext`) are what read `process.platform` for
 * real and hand the resolved hint down through their own context.
 *
 * @example
 * collapseCwdRuns(
 *   [
 *     { day: '2026-09-12', cwd: 'C:\\code' },
 *     { day: '2026-09-14', cwd: 'C:\\code' },
 *     { day: '2026-09-16', cwd: 'C:\\code\\seeya' },
 *   ],
 *   'win32',
 * )
 * // [
 * //   { cwd: 'C:\\code', firstDay: '2026-09-12', lastDay: '2026-09-14', exists: false },
 * //   { cwd: 'C:\\code\\seeya', firstDay: '2026-09-16', lastDay: '2026-09-16', exists: false },
 * // ]
 */
export function collapseCwdRuns(
  samples: readonly CwdHistorySample[],
  platformHint: PathPlatformHint,
): readonly CwdHistoryEntry[] {
  const runs: { cwd: string; firstDay: Day; lastDay: Day }[] = [];
  for (const sample of samples) {
    const normalized = normalizeCwdForComparison(sample.cwd, platformHint);
    const current = runs[runs.length - 1];
    if (
      current !== undefined &&
      normalizeCwdForComparison(current.cwd, platformHint) === normalized
    ) {
      current.lastDay = sample.day;
      continue;
    }
    runs.push({ cwd: sample.cwd, firstDay: sample.day, lastDay: sample.day });
  }
  return runs.map((run) => ({ ...run, exists: false }));
}

/** `day`, parsed back into its local `Y`/`M`/`D` fields — a deterministic transformation of a
 * value this module was already handed (`new Date(valor)`, D-019's permitted form, not a
 * `clock.now()` read), so `readCwdHistory` can walk backward from it with `subtractLocalDays`
 * exactly the way `application/find-pending-briefing.ts` walks backward from `clock.now()`. */
function dayToLocalDate(day: Day): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/**
 * The I/O half: reads `sessionId`'s handoff for `day` and each of the `maxScanDays` days before
 * it (`Storage.readHandoff`, the exact same per-day walk-back `findPendingBriefing` already does,
 * and the same `maxScanDays` ceiling — `Config.maxBriefingScanDays`, D-035 — so a session's cwd
 * history never reaches further back than the plan itself would have scanned to find `day` in the
 * first place), skipping any day with no handoff for this session (not every day has one). Then
 * collapses the result with `collapseCwdRuns` and asks `DirectoryExistence` once per distinct
 * directory found.
 *
 * Always includes `day` itself as the most recent sample when a handoff exists for it — which it
 * does for every caller of this function (`day` is always a `Briefing.day` a handoff was just read
 * from) — so the LAST entry's `cwd` is always the same directory the caller already knows as
 * "the" cwd for this session today, and the history only ever ADDS earlier context, never
 * contradicts it.
 *
 * `deps.platformHint` is threaded straight into `collapseCwdRuns` — this function itself never
 * reads `process.platform` either, for the same reason that function's own docstring gives.
 *
 * @example
 * const history = await readCwdHistory(
 *   { storage, directoryExistence, platformHint: context.platformHint },
 *   handoff.sessionId,
 *   briefing.day,
 *   config.maxBriefingScanDays,
 * );
 * // history.length > 1 means the directory changed at some point — worth a note (V2-T9 item 2/3).
 */
export async function readCwdHistory(
  deps: {
    readonly storage: Storage;
    readonly directoryExistence: DirectoryExistence;
    readonly platformHint: PathPlatformHint;
  },
  sessionId: string,
  day: Day,
  maxScanDays: number,
): Promise<readonly CwdHistoryEntry[]> {
  const samplesNewestFirst: CwdHistorySample[] = [];
  const anchor = dayToLocalDate(day);
  for (let offset = 0; offset <= maxScanDays; offset += 1) {
    const scannedDay = localDayString(subtractLocalDays(anchor, offset));
    const handoff = await deps.storage.readHandoff(scannedDay, sessionId);
    if (handoff !== null) {
      samplesNewestFirst.push({ day: scannedDay, cwd: handoff.cwd });
    }
  }
  const runs = collapseCwdRuns([...samplesNewestFirst].reverse(), deps.platformHint);
  return Promise.all(
    runs.map(async (run) => ({ ...run, exists: await deps.directoryExistence.exists(run.cwd) })),
  );
}
