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

/** Real environment read once, here — same reasoning `application/eligibility-assembly.ts`'s own
 * `PLATFORM_HINT` already documents: `process.platform` is a Node global, not an adapter, so
 * reading it directly in `application/` isn't the I/O D-020 bans. */
const PLATFORM_HINT: PathPlatformHint = process.platform === 'win32' ? 'win32' : 'posix';

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
 * @example
 * collapseCwdRuns([
 *   { day: '2026-09-12', cwd: 'C:\\code' },
 *   { day: '2026-09-14', cwd: 'C:\\code' },
 *   { day: '2026-09-16', cwd: 'C:\\code\\seeya' },
 * ])
 * // [
 * //   { cwd: 'C:\\code', firstDay: '2026-09-12', lastDay: '2026-09-14', exists: false },
 * //   { cwd: 'C:\\code\\seeya', firstDay: '2026-09-16', lastDay: '2026-09-16', exists: false },
 * // ]
 */
export function collapseCwdRuns(samples: readonly CwdHistorySample[]): readonly CwdHistoryEntry[] {
  const runs: { cwd: string; firstDay: Day; lastDay: Day }[] = [];
  for (const sample of samples) {
    const normalized = normalizeCwdForComparison(sample.cwd, PLATFORM_HINT);
    const current = runs[runs.length - 1];
    if (
      current !== undefined &&
      normalizeCwdForComparison(current.cwd, PLATFORM_HINT) === normalized
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
 * @example
 * const history = await readCwdHistory(
 *   { storage, directoryExistence },
 *   handoff.sessionId,
 *   briefing.day,
 *   config.maxBriefingScanDays,
 * );
 * // history.length > 1 means the directory changed at some point — worth a note (V2-T9 item 2/3).
 */
export async function readCwdHistory(
  deps: { readonly storage: Storage; readonly directoryExistence: DirectoryExistence },
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
  const runs = collapseCwdRuns([...samplesNewestFirst].reverse());
  return Promise.all(
    runs.map(async (run) => ({ ...run, exists: await deps.directoryExistence.exists(run.cwd) })),
  );
}
