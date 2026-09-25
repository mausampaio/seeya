/**
 * Core ports — the interfaces every access to the world has to go through
 * (docs/ARQUITETURA.md § "Princípio"). `core/` declares the interface; `adapters/`
 * implements it; `cli/` is the only composition root that names the concrete implementation and
 * injects it (D-020).
 *
 * **Ports are declared as their types come to exist, not all seven from
 * docs/ARQUITETURA.md's sketch up front.** A port whose signature references a type that doesn't
 * exist yet in this project would mean inventing that type too early just to fill in a signature,
 * or declaring the port with `unknown` — worse than not declaring it. `HandoffGenerator` (S2-T2),
 * `Storage` (S1-T5, grown further in S1-T7 and S2-T2) and `Notifier` (S4-T1, at the end of this
 * file) are all filled in below now that `GeneratedUnderstanding`/`EarlyWarningState`/`Notice`
 * exist.
 */
import type {
  AdoptionRecord,
  Config,
  Day,
  DaemonOwnershipTransitionAnswer,
  DiscoveredSession,
  EarlyWarningState,
  GeneratedUnderstanding,
  Handoff,
  ProjectManifest,
  ProjectSkeleton,
  ProtocolScheme,
  RepositoryMapEntry,
  SessionFacts,
} from './types.js';
import type { AuditableCommit } from './project-audit.js';
import type { LockHolderProcess } from './lock-holder-process.js';

/**
 * The project's single source of "now" (D-019). Implemented in `adapters/clock/`. No other
 * module calls `new Date()` with no argument, `Date.now()`, or a long-running
 * `setTimeout`/`setInterval` — this port is what returns the instant, and whoever needs it
 * receives it already resolved.
 */
export interface Clock {
  now(): Date;
  /**
   * Resolves after `ms` real milliseconds — the daemon's poll cadence (S4-T3,
   * docs/ESPECIFICACAO.md: "loop de verificação a cada 30 s") waits on this instead of a bare
   * `setTimeout` so `scheduler/` never calls a timer directly (D-019: `setTimeout`/`setInterval`
   * only exist in `adapters/clock/`). A test's `Clock` double resolves this however it needs to
   * (instantly, or after recording that it was called) without ever starting a real timer.
   */
  sleep(ms: number): Promise<void>;
}

/**
 * Process liveness and termination (D-002). Implemented in `adapters/process/` (S1-T2).
 * `isAlive` receives `procStart` to break ties on a recycled PID (docs/ESPECIFICACAO.md § "Como
 * as sessões são descobertas") — the pure decision of when two `procStart` values count as the
 * same process lives in `core/classification.ts#pidRepresentsSameProcess`; this port only
 * declares the async contract that the adapter fulfills by querying the real OS.
 *
 * **Grew `readCwd`/`readCommandLine` in S1-T10 (D-023), reverted in S1-T11 (D-029).** Those two
 * methods read a live PID's working directory and command line for the `.key`-without-`.json`
 * discovery strategy that D-023 added. D-029 revoked that strategy — the cause it attributed to
 * the phenomenon didn't hold up under measurement — so the two methods have no caller left and
 * came out with it. See docs/DECISOES.md D-029 and docs/QUESTOES.md Q-011 (the privacy question
 * `readCommandLine` raised, now moot because nothing captures a command line at all).
 *
 * **`terminateAbruptly` joined the port in V2-T5b.** Until this task it was a free function
 * (`adapters/process/termination.ts#terminateAbruptly`), reachable directly because its only
 * caller (`packages/cli/src/daemon-command.ts#runDaemonStop`) lived in `cli/`, a composition root
 * allowed to name a concrete adapter (D-020). Once `runDaemonStop` itself moved to `scheduler/`
 * (so the interface's own "Stop daemon" button could reuse it — see
 * `scheduler/daemon-control.ts`'s own module comment), it needed this call to go through a port:
 * `scheduler/` cannot import `adapters/` directly (docs/ARQUITETURA.md's matrix). Unconditional,
 * immediate termination — **never** used on a discovered Claude Code session (D-002 bans forced
 * kill for those in v1); see the adapter's own docstring for the one caller this exists for.
 */
export interface ProcessControl {
  isAlive(pid: number, procStart?: string): Promise<boolean>;
  terminateGracefully(pid: number, deadlineMs: number): Promise<boolean>;
  terminateAbruptly(pid: number): Promise<void>;
}

/**
 * One rejected external record surviving the merge in `SessionProvider.list()` (S1-T9):
 * structurally identical to `adapters/discovery/registry.ts#RejectedSessionRecord` and
 * `adapters/discovery/transcript-scan.ts#RejectedTranscriptRecord` (which is why no cast is
 * needed to hand either one to `DiscoveryResult.rejected`), declared here — not imported from
 * those adapter modules — because `core/` cannot import `adapters/` (D-020's layer matrix) and
 * this is the shape the *port* promises, independent of how many strategies produce it today.
 */
export interface RejectedDiscoveryRecord {
  readonly file: string;
  readonly raw: unknown;
  readonly reason: string;
}

/**
 * `SessionProvider.list()`'s return shape (S1-T9), carrying D-022's both-sides contract
 * ("aceitos e rejeitados com motivo") through the merge instead of losing it at the port
 * boundary. Both merged-in strategies (S1-T3's registry, S1-T8's transcript scan) already return
 * `{ sessions, rejected }` on their own; dropping `rejected` here would be exactly the kind of
 * silent omission D-022 exists to prevent, at the one point (`seeya sessions`, S1-T6) where a
 * caller could finally show it to the user — "3 sessions, 1 entry ignored" needs the rejections to
 * survive the merge to be sayable at all.
 */
export interface DiscoveryResult {
  readonly sessions: DiscoveredSession[];
  readonly rejected: RejectedDiscoveryRecord[];
}

/**
 * Session discovery (D-016). Implemented in `adapters/discovery/`, merging the strategies of
 * S1-T3 (registry) and S1-T8 (transcript scan) into a single deduplicated list of
 * `DiscoveredSession` — `list()` returns the already-merged union, never the raw concatenation of
 * the sources: callers shouldn't need to know how many strategies exist underneath, nor
 * deduplicate on their own. A third strategy (D-023, process + `.key`) existed between S1-T10 and
 * D-029; see that decision for why it was removed.
 *
 * **`list()` returns `DiscoveryResult`, not bare `DiscoveredSession[]` (S1-T9).** The sketch in
 * docs/ARQUITETURA.md § "Portas" still shows `list(): Promise<DiscoveredSession[]>` — that sketch
 * predates S1-T9 and wasn't updated because ARQUITETURA.md's boundary text needs PO approval to
 * change (AGENTS.md § "Ordem de autoridade"). See docs/QUESTOES.md Q-012 for the question this
 * opened, and D-022 for why dropping `rejected` at this boundary isn't an option.
 */
export interface SessionProvider {
  list(): Promise<DiscoveryResult>;
}

// Own import line on purpose (V2-T55), same self-contained pattern already established above
// (`DayState`, `DaemonLockInfo`): `SessionIdLookupOutcome` is this task's own new type.
import type { SessionIdLookupOutcome } from './types.js';

/**
 * On-demand, `relevanceHours`-ignoring session lookup by `sessionId` or a prefix of it (V2-T55
 * item 1) — deliberately a SEPARATE port from `SessionProvider.list()`, never a parameter or a
 * second method on it, precisely so nothing wires this into a periodic cycle by accident (the
 * sidebar's 10s refresh tick, `scheduler/poll.ts`'s own loop): every call this port answers means
 * a full, unwindowed walk of every transcript under `~/.claude/projects/`
 * (`adapters/discovery/session-id-lookup.ts`), worth paying only when a person is actually looking
 * for one specific, possibly long-closed session (`seeya project adopt <id>`, the window's own
 * id-search field) — never for "what's on screen right now".
 *
 * Implemented in `adapters/discovery/` (D-020: `core/` never implements a port, only declares it).
 */
export interface SessionIdLookup {
  findByIdPrefix(idPrefix: string): Promise<SessionIdLookupOutcome>;
}

// Own import line on purpose (S4-T3), same self-contained pattern already established below
// (`GitFacts`, `ResumeOutcome`): `DayState` now exists (S4-T2) for `readState`/`saveState` below,
// and `DaemonLockInfo` (`core/daemon-lock.ts`) is this task's own new type for the daemon lock.
import type { DayState } from './types.js';
import type { DaemonLockInfo } from './daemon-lock.js';

/**
 * Persistence at `~/.seeya/` (D-027). Implemented by `adapters/storage/` (S1-T5). The root is
 * always injected into the adapter's constructor, never read from `os.homedir()` inside it — same
 * rule `adapters/discovery/` already follows for `~/.claude` — so no test touches the real
 * `~/.seeya/`.
 *
 * **Only `readConfig` for now.** docs/ARQUITETURA.md's sketch of this port also lists
 * `saveHandoff(day: Day, handoff: Handoff)`, `readBriefing(day: Day)` and
 * `saveState(state: DayState)` — but `Day`, `Handoff`, `Briefing` and `DayState` don't exist as
 * types yet (they arrive with S2-T2/S2-T3/S2-T4 and S4-T2). Declaring those methods now would
 * mean typing them `unknown` or inventing four types this task doesn't need just to fill a
 * signature — the same reasoning this file's top comment already applies to `TranscriptReader`,
 * `HandoffGenerator` and `Notifier`. Whoever implements those later tasks grows this interface
 * additively once the types it needs exist for real; docs/QUESTOES.md Q-013 has the note on this
 * scope cut.
 */
export interface Storage {
  /**
   * Reads `~/.seeya/config.json`, resolved against defaults. A file that doesn't exist yet
   * (nothing written on this machine so far) is not an error (D-025): every field comes back at
   * its default. A file that exists but is malformed — invalid JSON, a field of the wrong shape,
   * or a `schemaVersion` this build doesn't know how to read — rejects instead of silently
   * falling back to defaults: only *absence* reads as "use the defaults", never *corruption*.
   */
  readConfig(): Promise<Config>;

  /**
   * Persists `config` at `~/.seeya/config.json`, atomically, overwriting the whole document —
   * same "write what's asked, whole" contract `saveState` already has below, not a partial patch.
   * Added in S4-T4 for `seeya config` (docs/ESPECIFICACAO.md § `seeya config`: "Lê e escreve
   * `config.json`") — the FIRST production caller that ever writes this file; every path above
   * only ever reads it (`readConfig` has existed since S1-T5).
   *
   * **This is also the first real reader+writer pair for `config.json`.** `scheduler/poll.ts`
   * calls `readConfig()` at the top of every 30s cycle while the daemon runs, so a `seeya config
   * set` from a terminal can now race a live daemon's read the same way `seeya snooze`/
   * `skip-today` already race its `estado.json` read/write. `adapters/storage/atomic-write.ts`'s
   * own module comment flagged this exact gap before it existed ("não há chamador que leia e
   * escreva `config.json` concorrentemente... até S4-T4... remedir antes de assumir que continua
   * sem problema") — see docs/QUESTOES.md Q-056 for what was actually measured here, not assumed.
   */
  saveConfig(config: Config): Promise<void>;

  /**
   * Reads the "already warned" bookkeeping S1-T7's early-warning detection needs to keep a
   * warning from firing more than once (docs/DECISOES.md D-018, D-029;
   * `core/early-warnings.ts#detectEarlyWarnings`). A file that doesn't exist yet (nothing warned
   * about on this machine so far) is not an error (D-025): both sets in `EarlyWarningState` come
   * back empty. A file that exists but is malformed rejects — same policy as `readConfig`,
   * corruption is never silently read as "nothing warned yet".
   *
   * **Grown additively in S1-T7**, same as this port's docstring above already anticipated for
   * `saveHandoff`/`readBriefing`/`saveState` — this method and `saveEarlyWarningState` below
   * exist because `EarlyWarningState` (`core/types.ts`) now exists to type them.
   */
  readEarlyWarningState(): Promise<EarlyWarningState>;

  /**
   * Persists the state `detectEarlyWarnings` returned as `nextState`. This port doesn't diff for
   * the caller — `adapters/discovery/early-warnings.ts` only calls this when at least one new
   * warning fired, to avoid a write on every idle discovery pass.
   */
  saveEarlyWarningState(state: EarlyWarningState): Promise<void>;

  /**
   * Persists `handoff` at `~/.seeya/days/<day>/sessions/<sessionId>.json`
   * (docs/ESPECIFICACAO.md § "Formato do handoff"), atomically. D-002's ordering requirement —
   * "handoff gravado e verificado em disco → só então terminar o processo" — is why
   * `application/endDay` (S2-T3) always calls `readHandoff` right after this one to confirm the
   * write actually landed before ever touching `ProcessControl.terminateGracefully`; this method's
   * own job stops at "the write completed without throwing".
   *
   * **Grown additively in S2-T3**, same pattern this port's docstring already used for
   * `readEarlyWarningState`/`saveEarlyWarningState` in S1-T7: `Handoff`/`Day` (`core/types.ts`)
   * now exist to type it.
   */
  saveHandoff(day: Day, handoff: Handoff): Promise<void>;

  /**
   * Reads one session's handoff for `day`, or `null` when it doesn't exist yet — no capture made
   * today for this session is normal, not an error (D-025). This is the read side D-026's
   * anti-duplication needs: has this session already been captured today, and with what evidence
   * (`core/evidence.ts#buildEvidenceSignature`, applied to the returned `Handoff.facts`). A file
   * that exists but is malformed rejects — same policy as `readConfig`/`readEarlyWarningState`,
   * corruption is never silently read as "nothing captured yet".
   *
   * **Not in docs/ARQUITETURA.md § "Portas"'s sketch of this port**, which only lists
   * `readBriefing(day)` — the whole day's consolidated `summary.md` (S2-T4), a human-readable
   * markdown document with nowhere to parse a single session's exact `facts` back out of. Same
   * shape of divergence already recorded for `DiscoveryResult`/`TranscriptReadResult`/
   * `GitReadResult` above: the sketch predates a constraint the implementing task found. Flagged in
   * docs/QUESTOES.md (S2-T3) instead of edited into `ARQUITETURA.md` directly (AGENTS.md § "Ordem
   * de autoridade").
   */
  readHandoff(day: Day, sessionId: string): Promise<Handoff | null>;

  /**
   * Reads every handoff written for `day` (`~/.seeya/days/<day>/sessions/*.json`), validating
   * each file independently — D-022 names "os handoffs lidos de `~/.seeya/`" explicitly as a
   * collection that must be checked item by item, never `z.array`'s tudo-ou-nada. One corrupted or
   * hand-edited file never takes the rest of the day down: it's reported in `rejected`
   * (`RejectedDiscoveryRecord`, same `file`/`raw`/`reason` shape `DiscoveryResult` already uses)
   * and excluded, while every other handoff still comes back in `handoffs`.
   *
   * A missing or empty `sessions/` directory (nothing captured yet today) resolves to
   * `{ handoffs: [], rejected: [] }`, not an error (D-025) — same "absence is normal" policy as
   * `readConfig`/`readEarlyWarningState`/`readHandoff` above.
   *
   * Added in S2-T4 for `generateBriefingMarkdown` (`core/briefing.ts`): the day's consolidated
   * `summary.md` is built from every handoff captured so far today, not only the ones a single
   * `endDay` run just wrote, so re-running `seeya end-day --session <id>` (S2-T5) later the same
   * day still produces a briefing reflecting everyone captured earlier.
   */
  listHandoffs(day: Day): Promise<{
    readonly handoffs: Handoff[];
    readonly rejected: RejectedDiscoveryRecord[];
  }>;

  /**
   * Persists `markdown` at `~/.seeya/days/<day>/summary.md` (docs/ESPECIFICACAO.md § "Formato do
   * handoff": "ao lado da pasta `sessions/`"), atomically — same `writeFileAtomic` every other
   * write under `~/.seeya/` uses, reused rather than duplicated.
   *
   * **Named `saveBriefing`, not in AGENTS.md § "Idioma"'s glossary table.** That table fixes
   * `readBriefing` (for S3-T1, still unimplemented) but never named the write side — an oversight
   * this task fills by the same `save<Noun>`/`read<Noun>` pattern `saveHandoff`/`readHandoff` and
   * `saveEarlyWarningState`/`readEarlyWarningState` already established, rather than a new,
   * unrelated verb. Flagged in docs/QUESTOES.md for confirmation, per AGENTS.md § "Glossário de
   * domínio": "termo novo entra aqui antes de entrar no código".
   */
  saveBriefing(day: Day, markdown: string): Promise<void>;

  /**
   * Reads `day`'s consolidated `Briefing` — every handoff captured for `day`, exactly as
   * `listHandoffs(day)` already returns them, with `day` attached; no second read path and no new
   * on-disk format. `null` when there is truly nothing for that day at all (no `sessions/`
   * directory, nothing ever captured) — D-025: absence of any capture is a different,
   * less-specific state than "a day with zero pending work", and this method doesn't blur the
   * two. A day where every handoff on file failed validation (`handoffs: []`, `rejected`
   * non-empty) is NOT the same as "nothing happened" and still comes back as a `Briefing`, not
   * `null` — silently hiding a day of unreadable files would be exactly the omission D-022 exists
   * to prevent.
   */
  readBriefing(day: Day): Promise<Briefing | null>;

  /**
   * Reads which `sessionId`s have already been resumed for `day` — `seeya start-day`'s step 5
   * (docs/ESPECIFICACAO.md § `seeya start-day`: "Marca o briefing como retomado"), decided in
   * S3-T3 to be per-SESSION rather than per-day (docs/QUESTOES.md, and see
   * `core/pending-briefing.ts`'s docstring for the full reasoning: marking a whole day resumed
   * after only one of its several sessions actually got resumed would make the others silently
   * vanish from "pending", which is D-025's mistake aimed at a person's whole day of work instead
   * of one field). A day with nothing resumed yet — including a day that was never captured at
   * all — comes back as an empty set (D-025: absence, not an error).
   *
   * Named to match the `read<Noun>`/`save<Noun>` pair this port already uses elsewhere
   * (`readEarlyWarningState`/`saveEarlyWarningState`, `readHandoff`/`saveHandoff`) rather than an
   * "append" verb: the append/diff logic (which id is new, when to persist) belongs to
   * `application/start-day.ts#resumeSessions`, the same split `core/early-warnings.ts` already
   * draws between "decide what changed" (pure) and "persist it" (this port).
   */
  readResumedSessionIds(day: Day): Promise<ReadonlySet<string>>;

  /**
   * Persists the full set of resumed `sessionId`s for `day` — not an increment. Same shape as
   * `saveEarlyWarningState`: the caller (`application/start-day.ts#resumeSessions`) reads the
   * current set, adds the one `sessionId` that JUST finished resuming, and calls this with the
   * whole updated set — one write per session, right after that session's `SessionResumer.resume()`
   * call actually returned, never before (D-002's "fact, then mark" ordering, applied here to
   * bookkeeping instead of process termination) and never batched at the end, so a crash midway
   * through `--all` still leaves every session resumed BEFORE the crash correctly marked.
   *
   * A `SessionResumer.resume()` call that fell back to a fresh session (D-004) still counts as
   * resumed here — the person got the plan and a session to work in either way, just not a
   * continuation of the original conversation. Only a `resume()` that THROWS (the fallback itself
   * also failing fast) is never marked, because nothing happened for that session at all.
   *
   * Persisted at `~/.seeya/days/<day>/resumed.json` — `{ schemaVersion, sessionIds: string[] }` —
   * a new on-disk identifier not yet in AGENTS.md § "Idioma"'s "Identificadores que vão para
   * disco" table, flagged in docs/QUESTOES.md for the PO to fold in, same non-blocking pattern
   * S1-T7 already used for `early-warnings.json`. Chosen over folding this into the handoff itself
   * (`Handoff` is written once, at capture time, by a different command entirely — `seeya
   * end-day` — and re-opening/rewriting every one of a day's handoff files just to flip one field
   * would touch documents `start-day` has no other reason to write) and over one file per session
   * (a single small set, read and rewritten whole, is simpler than N small files for what is at
   * most a handful of sessions per day — D-027: the key is cheap to pick now, so pick the simpler
   * shape).
   */
  saveResumedSessionIds(day: Day, sessionIds: ReadonlySet<string>): Promise<void>;

  /**
   * Reads `~/.seeya/estado.json` (D-006's own text names this exact file; AGENTS.md § "Idioma"
   * reserves it and the `saveState` method name below for S4-T3) — the daemon's `DayState`
   * bookkeeping (`core/schedule.ts`, S4-T2). `null` when nothing has been persisted yet on this
   * machine (D-025: a machine that never ran the daemon, or never called `seeya
   * snooze`/`skip-today`, is not an error) — the caller (`scheduler/poll.ts`) is what turns `null`
   * into `core/schedule.ts#emptyDayState(today)`, because building that default needs `today`
   * (from `Clock`), which this port has no way to supply on its own. A file that exists but is
   * malformed rejects — same corruption policy as `readConfig`/`readEarlyWarningState` above.
   *
   * **Single file, not one per day** (S4-T3, D-027's "escolha com cuidado" applied here): unlike
   * `resumed.json` (keyed under `days/<day>/`), `estado.json` sits at the `~/.seeya/` root, next to
   * `config.json`/`early-warnings.json`. `DayState.day` is what lets a single file represent
   * "today's" bookkeeping and self-detect a stale previous day — `core/schedule.ts`'s own
   * `resetIfNewDay` already depends on that field existing on the persisted value, which only holds
   * if the same file is reused and re-interpreted across days rather than a fresh one appearing
   * per day (see `core/types.ts#DayState`'s own docstring, Q-037 item 6, for why the reset has to
   * be decidable from the value alone).
   */
  readState(): Promise<DayState | null>;

  /**
   * Persists `state` at `~/.seeya/estado.json`, atomically — the `nextState` half of
   * `core/schedule.ts#ScheduleDecisionResult`, written only AFTER the caller's own action for this
   * poll succeeded (that file's top comment: "this file never assumes an action succeeded" — this
   * method is where the caller's confirmation actually lands). Also what `seeya
   * snooze`/`skip-today` (S4-T4) write to, independent of whether the daemon is running
   * (docs/ESPECIFICACAO.md § those two commands: "funcionam com ou sem daemon rodando — o estado é
   * persistido, não guardado em memória") — which is also why `scheduler/poll.ts` re-reads this
   * with `readState()` at the START of every single poll instead of keeping its own in-memory copy
   * across iterations: a concurrent `seeya snooze` has to be visible on the very next poll.
   */
  saveState(state: DayState): Promise<void>;

  /**
   * Reads `~/.seeya/daemon.lock` (D-005's own text names this exact file) — S4-T3's single-instance
   * guard. `null` when no daemon has ever run on this machine (D-025). A file that exists but is
   * malformed rejects, same policy as every other document here — a hand-edited or truncated lock
   * file is a real problem to surface, never silently read as "no daemon running".
   *
   * Liveness is NOT this port's job: `core/daemon-lock.ts#decideLockAcquisition` is what turns the
   * returned `pid` plus a separate `ProcessControl.isAlive` call into an accept/refuse decision —
   * this method only ever reports what the file currently says, a fact independent of whether that
   * PID still exists.
   */
  readDaemonLock(): Promise<DaemonLockInfo | null>;

  /**
   * Unconditionally overwrites `~/.seeya/daemon.lock` with `lock`, atomically — called once,
   * right after `core/daemon-lock.ts#decideLockAcquisition` returns `'acquire'`
   * (`scheduler/lock.ts`). Not a create-if-absent primitive: the accept/refuse decision already
   * happened by the time this runs, so there is nothing left for this method itself to guard —
   * see `core/daemon-lock.ts`'s own top comment for the race window this accepts (no `procStart`
   * tie-break, and a small gap between the read that informed `decideLockAcquisition` and this
   * write, same shape of trade-off as every other "human runs a CLI command" tool in this project).
   */
  writeDaemonLock(lock: DaemonLockInfo): Promise<void>;

  /**
   * Removes `~/.seeya/daemon.lock`, tolerating it already being absent (D-025: a lock that was
   * never written, or was already cleared, is not an error to clear again) — best-effort cleanup
   * called on a clean daemon shutdown (`scheduler/lock.ts`). A daemon that dies uncleanly (crash,
   * `taskkill`, a Windows session with no console to deliver a signal to at all, D-005) simply never
   * calls this — the NEXT `seeya daemon` start is what notices the stale lock, via
   * `readDaemonLock` + a liveness check, not this method.
   */
  clearDaemonLock(): Promise<void>;

  /**
   * V2-T5b item 5, upgraded by V2-T10 item 2: which `seeya://`-shaped scheme
   * (`core/types.ts#ProtocolScheme`) the most recently opened window of the interface registered
   * as the `seeya`/`seeya-dev` protocol handler on this machine
   * (`app.setAsDefaultProtocolClient`, `packages/app/src/composition/index.ts`/`electron/main.ts`).
   * `null` when the marker (`~/.seeya/protocol-handler.json`) doesn't exist — D-025: absence reads
   * as "no window has registered anything yet", never as a guess either way. The daemon's own
   * Windows toast backend (`adapters/notification/windows-toast.ts`) reads this BEFORE deciding
   * whether to include a `launch` attribute on a toast: without it, a click would surface
   * Windows' own "how do you want to open seeya?" picker instead of focusing the window.
   *
   * **Why "the active scheme", not "is `seeya` registered"** (V2-T10's own plan entry, "o
   * achado"). Two worlds — a packaged install and a dev checkout — can each be running, each
   * registering its OWN scheme (`seeya`/`seeya-dev`); the daemon that sends every toast serves
   * both. Reading back a single scheme (whichever window opened last) is what lets a toast click
   * reach the window the person is actually using, instead of always the same hardcoded one.
   */
  readActiveProtocolScheme(): Promise<ProtocolScheme | null>;

  /**
   * Persists that `scheme` was just registered as the active window's own protocol handler —
   * atomically, idempotent for the same `scheme` (calling this again with an unchanged value is a
   * no-op in effect, same "overwrite the whole document" contract every other `save*` method on
   * this port already has) and OVERWRITING for a different one (the most recently opened window
   * always wins, V2-T10's own "segue a última janela aberta"). Never CLEARED by this project: once
   * a scheme has been registered on a machine, Windows itself keeps the association even across a
   * `seeya` uninstall/reinstall, so there is no "unregister" event for this method's own caller to
   * react to in v2's own scope.
   */
  saveActiveProtocolScheme(scheme: ProtocolScheme): Promise<void>;

  /**
   * V2-T13 (D-045 item 1): the person's answer to the daemon-ownership transition question, the
   * ONE time the app finds itself `DaemonOwner.kind === 'app'` while a CLI-launched daemon or
   * CLI-registered autostart already exists (`core/types.ts#DaemonOwnershipTransitionAnswer`'s own
   * docstring has the full "why persisted" reasoning). `null` when the question has never been
   * asked/answered on this machine (D-025) — never a guess either way, same "absence reads as
   * nothing happened yet" contract `readActiveProtocolScheme` above already documents for its own
   * marker file.
   */
  readDaemonOwnershipTransitionAnswer(): Promise<DaemonOwnershipTransitionAnswer | null>;

  /**
   * Persists `answer` to `~/.seeya/daemon-ownership-transition.json`, atomically. Called exactly
   * once per machine, right after the person answers the dialog — never called again afterward
   * (`readDaemonOwnershipTransitionAnswer`'s non-`null` result is what stops the question from
   * being asked a second time, D-045's own "não pergunta de novo" for EITHER answer).
   */
  saveDaemonOwnershipTransitionAnswer(answer: DaemonOwnershipTransitionAnswer): Promise<void>;

  /**
   * V2-T27: where the workspace (the single git repository `WorkspaceRepository` manages, holding
   * every project) lives on THIS device — `docs/PLANO-DE-ENTREGA.md`'s own words: "onde o espaço
   * de trabalho mora, perguntado uma vez e guardado em `~/.seeya/`". `null` when nothing has been
   * resolved yet on this machine (D-025) — `application/workspace.ts#resolveWorkspaceRoot` is what
   * turns that into the default path and persists it via `saveWorkspaceRoot`, the one time this
   * matters; this port only ever reports what's on disk, never invents a default itself.
   */
  readWorkspaceRoot(): Promise<string | null>;

  /**
   * Persists `root` to `~/.seeya/workspace.json`, atomically. Called once, by
   * `application/workspace.ts#resolveWorkspaceRoot`, the first time any `seeya project` command
   * runs on a machine with no workspace location recorded yet — never called again afterward on
   * the same machine (same "decided once" contract `saveActiveProtocolScheme`'s neighbors on this
   * port already follow for their own one-shot markers).
   */
  saveWorkspaceRoot(root: string): Promise<void>;

  /**
   * V2-T28: `~/.seeya/repository-map.json` — where every repository `add-repo` has recorded is
   * checked out on THIS device (`core/types.ts#RepositoryMapEntry`'s own docstring on the two key
   * shapes). Empty when nothing has been registered yet (D-025), never an error.
   */
  readRepositoryMap(): Promise<readonly RepositoryMapEntry[]>;

  /** Replaces `repository-map.json`'s entire contents with `entries` — the caller
   * (`application/repository-association.ts#addRepository`) always reads first, upserts one entry
   * with `core/repository-map.ts#upsertRepositoryMapEntry`, and writes the whole result back; this
   * method itself doesn't merge. */
  saveRepositoryMap(entries: readonly RepositoryMapEntry[]): Promise<void>;

  /**
   * V2-T29: `~/.seeya/adoptions.json` — every accepted adoption on this device
   * (`core/types.ts#AdoptionRecord`'s own docstring). Empty when nothing has been adopted here yet
   * (D-025), never an error. `application/project-adopt.ts#adoptSession` is the only caller that
   * reads this to refuse re-adopting an original session (`core/adoption-registry.ts
   * #findAdoptionRecord`).
   */
  readAdoptions(): Promise<readonly AdoptionRecord[]>;

  /** Replaces `adoptions.json`'s entire contents with `records` — same append-by-read-then-write
   * contract `saveRepositoryMap` already has above; this method itself doesn't merge. */
  saveAdoptions(records: readonly AdoptionRecord[]): Promise<void>;
}

/**
 * `TranscriptReader.readFacts()`'s return shape (S1-T4) — the same "both sides" shape
 * `DiscoveryResult` gives `SessionProvider.list()` (S1-T9) above. docs/ARQUITETURA.md § "Portas"
 * sketches `readFacts` returning a bare `SessionFacts`; that sketch predates this decision the
 * same way it predated `DiscoveryResult` (see the comment on that interface). D-022 names "as
 * entradas do `.jsonl` de transcript" explicitly as a collection that must be validated per item,
 * with both the accepted and the rejected side visible — a bare `SessionFacts` has nowhere to
 * carry the rejected side, so returning one would silently drop exactly the visibility D-022
 * exists to guarantee.
 */
export interface TranscriptReadResult {
  readonly facts: SessionFacts;
  /**
   * A recognized entry type (`user`/`assistant`) whose content failed its schema — most often a
   * truncated final line written mid-flush (docs/TESTES.md's mandatory fixture), but any other
   * structural mismatch lands here too. Reuses `RejectedDiscoveryRecord`'s `file`/`raw`/`reason`
   * shape: same D-022 contract, one external item that failed validation, with the raw value and
   * why. `file` carries `<transcriptPath>:<lineNumber>` so one line stays traceable inside a
   * single file.
   */
  readonly rejected: RejectedDiscoveryRecord[];
  /**
   * Count of lines whose `type` isn't one of `KNOWN_ENTRY_TYPES`
   * (`adapters/transcript/schemas.ts`). Not a rejection — that module's docstring is explicit
   * that a new entry type is normal version drift, "ignored, not an error" — but kept visible and
   * counted (S1-T4's acceptance criteria) so "the format changed under us" doesn't look identical
   * to "nothing happened".
   */
  readonly unknownEntryTypeCount: number;
}

/**
 * Reads a session's transcript and extracts `SessionFacts` (D-003's fact layer). Implemented in
 * `adapters/transcript/` (S1-T4): streaming, line by line — real transcripts pass 1 MB
 * (docs/TESTES.md § transcript/), and holding one whole in memory just to find its last few
 * prompts is exactly the design that fixture exists to catch.
 *
 * Rejects only on a real I/O failure reading the located file (permission denied, the file
 * vanishing mid-read) — same contract as
 * `adapters/discovery/transcript-cwd.ts#readCwdFromTranscript`. A session that simply has no
 * transcript (`hasTranscript: false`, D-013) is the normal "no evidence" case, not a rejection:
 * the implementation resolves that by never finding a file to open, not by throwing, and answers
 * with every `SessionFacts` field at its least-specific value (D-025) instead.
 */
/**
 * D-031's listing entries — `ai-title` and `last-prompt`, entries Claude Code already writes to
 * the transcript for its own "away summary" UI (Spike I) and that this project reads for the one
 * case they serve: identifying, for a human, a session that fell outside the day's capture scope
 * (`core/capture-scope.ts#isCaptureCandidate`, `core/types.ts#SessionListing`). Kept as its own
 * shape rather than folded into `SessionFacts`/`TranscriptReadResult` above: a listed session never
 * goes through `readFacts`'s capture pipeline at all (D-031: it was never a capture candidate), so
 * nothing else that shape carries — `lastActivity`, `touchedFiles`, `assistantMessages` — is ever
 * needed for it, and giving the handoff-oriented type two fields it can never use would blur why
 * they're there (D-024's reasoning, applied to a much smaller pair of fields here).
 *
 * Both `null` when absent (D-025) — `ai-title` is an internal, undocumented entry type (D-031's own
 * ressalva): absence is "listing without a title", never an invented one.
 */
export interface TranscriptListingInfo {
  readonly aiTitle: string | null;
  readonly lastPrompt: string | null;
}

export interface TranscriptReader {
  readFacts(session: DiscoveredSession): Promise<TranscriptReadResult>;

  /**
   * Reads just the two D-031 listing entries from `session`'s transcript. Cheap and independent
   * from `readFacts`'s own streaming pass — no model call either way, but a listed session
   * (D-031: transcript only, no live registry entry) never enters the capture pipeline, so there is
   * no reason to also extract `SessionFacts`' other fields for it. Same "not found is not an error"
   * contract as `readFacts`: a session whose transcript can't be located, or whose transcript never
   * carried either entry, answers with both fields `null` (D-025) rather than rejecting.
   */
  readListingInfo(session: DiscoveredSession): Promise<TranscriptListingInfo>;
}

// Own import line on purpose, not folded into the block above: a second in-flight task (S2-T2)
// touches this same file's top import block, and D-022/D-025 already established the pattern of
// keeping an addition self-contained to reduce merge collisions (see this file's own history).
import type { GitFacts, RepositoryGitFacts } from './types.js';

/**
 * `GitReader.readFacts()`'s return shape (S2-T1). A discriminated union, not `GitFacts | null` —
 * same reasoning `core/types.ts#DiscoveredSession` already applies to `hasPid` (D-024): `cwd` not
 * being a git repository at all is a real, ordinary case
 * (docs/ARQUITETURA.md § `git/`: "não quebra quando o `cwd` não é repositório: devolve 'sem git'
 * e segue"), and giving it its own shape — with no `facts` field to accidentally read as an empty
 * `GitFacts` — is what makes "no git here" impossible to confuse with "a repo with nothing going
 * on" (D-025).
 *
 * `rejectedWorktrees` only exists on the `hasGit: true` side, reusing `RejectedDiscoveryRecord`'s
 * `file`/`raw`/`reason` shape (D-022, same reuse `TranscriptReadResult.rejected` above already
 * does) for one worktree whose own state couldn't be read — most commonly, `git worktree list`
 * still remembers a worktree whose directory is gone from disk — without that one failure taking
 * down the enumeration of the others.
 */
export type GitReadResult =
  | { readonly hasGit: false }
  | {
      readonly hasGit: true;
      readonly facts: GitFacts;
      readonly rejectedWorktrees: readonly RejectedDiscoveryRecord[];
    };

/**
 * Reads git facts for a session's `cwd` — D-013's first and most reliable evidence source, and
 * per that decision's own text, often the *only* substantive source for a session with no usable
 * transcript. Implemented in `adapters/git/` (S2-T1).
 *
 * Never throws for the ordinary "no evidence" cases: `cwd` not being a git repository at all
 * resolves to `{ hasGit: false }`, never a thrown error that would abort the whole capture over
 * an input this port considers completely normal (docs/ARQUITETURA.md § `git/`).
 *
 * **This port's name and its method's name are new terms, not yet in AGENTS.md's glossary.**
 * Chosen to mirror `TranscriptReader`/`readFacts` above, since both ports answer the same kind of
 * question (D-013 evidence facts) with the same "both-sides" shape for their fallible part.
 * Flagged in docs/QUESTOES.md for confirmation, per AGENTS.md § "Glossário de domínio": "termo
 * novo entra aqui antes de entrar no código" — registering instead of deciding silently.
 */
/**
 * `GitReader.readEvidenceAcrossRepos()`'s return shape (D-032, S4-T0). One `RepositoryGitFacts`
 * per repository root discovered among a session's `touchedFiles` and its own launch `cwd` — see
 * that type's own docstring in `core/types.ts` for why `root` lives on each entry instead of a
 * caller supplying a single `cwd` up front the way `readFacts` above still does.
 *
 * `filesOutsideRepository`/`reposNotVisited` are D-025's "declare it, don't drop it" applied to two
 * different reasons a piece of evidence might be missing: a touched file with no repository
 * ancestor at all, and a repository root that WAS found but skipped for staying inside the E/S
 * ceiling (`adapters/git/git-adapter.ts`'s `MAX_GIT_ROOTS_TO_VISIT` — a cost limit, not a judgment
 * about which repository matters more, same distinction docs/QUESTOES.md Q-025 already drew for
 * `MAX_BRIEFING_SCAN_DAYS`). Both are always real numbers here — never `null` — because a live call
 * to this method always knows both counts; `null` only ever appears on the persisted
 * `HandoffFacts` shape, for a handoff migrated up from schemaVersion 1, which never tracked either.
 */
export interface GitEvidenceAcrossRepos {
  readonly repositories: readonly RepositoryGitFacts[];
  readonly filesOutsideRepository: number;
  readonly reposNotVisited: number;
}

export interface GitReader {
  readFacts(cwd: string): Promise<GitReadResult>;

  /**
   * D-032: given a session's own launch `cwd` and its already-extracted `touchedFiles`, finds
   * every distinct repository root among them (walking up from each path to a `.git` entry,
   * `adapters/git/repo-roots.ts#findRepoRoot`; deduplicated after normalizing via
   * `core/cwd-normalization.ts`, S3-T5 — reused, not reimplemented) and calls `readFacts` for each
   * one, up to an I/O ceiling. `cwd`'s own root is always resolved first and always kept inside
   * that ceiling, so a session launched from inside a repository never loses evidence it already
   * had before this method existed (docs/PLANO-DE-ENTREGA.md S4-T0: "o `cwd` de lançamento
   * continua valendo quando for repositório").
   *
   * Never throws for the ordinary "nothing found" cases, same discipline as `readFacts`: a `cwd`
   * and every `touchedFiles` entry outside any repository resolves to `{ repositories: [],
   * filesOutsideRepository: N, reposNotVisited: 0 }`, never a thrown error.
   *
   * `maxRootsToVisit` is `Config.maxGitRootsToVisit` (D-035) — optional here so a caller that
   * doesn't have (or doesn't care about) the configured value still compiles, falling back to
   * whatever the concrete adapter (`adapters/git/git-adapter.ts#GitAdapter`) treats as its own
   * default. `application/evidence-gathering.ts` is the one production caller, and always passes
   * the real config value through.
   */
  readEvidenceAcrossRepos(
    cwd: string,
    touchedFiles: readonly string[],
    maxRootsToVisit?: number,
  ): Promise<GitEvidenceAcrossRepos>;

  /**
   * V2-T28: `git remote get-url origin` at `cwd` — what `seeya project add-repo` reads to derive a
   * repository's identity. `null` covers every ordinary "no resolvable remote" case alike
   * (`cwd` isn't a git repository at all, it is one but has no `origin` configured, or the command
   * simply fails) — `docs/PLANO-DE-ENTREGA.md` V2-T28 item 2 treats all of these the same way, as
   * "repositório sem remoto", never a thrown error a caller has to catch. Never throws.
   */
  readRemoteUrl(cwd: string): Promise<string | null>;
}

/**
 * Generates the "understanding" layer of a handoff (D-003's layer 2) by calling headless `claude`
 * (D-001, D-011). Implemented in `adapters/generation/` (S2-T2) as two classes behind this one
 * port — `LeanHandoffGenerator` (default: fresh disposable session built from `facts`) and
 * `DeepHandoffGenerator` (`--resume`s `session.sessionId` with `--fork-session`, registers the
 * fork per D-012) — chosen by `deepCapture` config, never by an `if` inside a shared
 * implementation (D-011: "duas implementações atrás da mesma porta; a escolha é config"). `cli/`,
 * the only composition root (D-020), is what picks which implementation a given project's policy
 * gets.
 *
 * **Takes the whole `DiscoveredSession`, not just `SessionFacts` — a departure from
 * docs/ARQUITETURA.md § "Portas"'s sketch (`generate(facts: SessionFacts)`).** The deep variant
 * needs `session.sessionId` to resume; `SessionFacts` (S1-T4, transcript-only extraction) carries
 * no session identity at all. Same shape of divergence already recorded for `SessionProvider.list()`
 * (`DiscoveryResult`, Q-012) and `TranscriptReader.readFacts()` (`TranscriptReadResult`, Q-014):
 * the sketch predates a constraint the implementing task found, and in both those cases the
 * resolution was "the port is right, the sketch was outdated". Not edited into
 * `docs/ARQUITETURA.md` directly — that requires PO approval (AGENTS.md § "Ordem de
 * autoridade") — flagged instead in docs/QUESTOES.md Q-019, and the minimal signature change
 * applied in the meantime per AGENTS.md's "abra a questão e siga com a solução mínima".
 *
 * **Rejects with a typed error on any failure** (spawn error, hard timeout, non-zero exit,
 * invalid JSON, output failing its own schema, or the model itself reporting `is_error`) — see
 * `adapters/generation/errors.ts#GenerationError`. Per docs/ARQUITETURA.md § `generation/`: "Erro
 * tipado. Quem decide o fallback é application/, não o adapter" — this port never manufactures a
 * `source: "deterministic"` result itself. `application/endDay` (S2-T3) is what catches the
 * rejection and builds the deterministic handoff (D-003); this port only ever resolves with a
 * real model result.
 */
export interface HandoffGenerator {
  generate(session: DiscoveredSession, facts: SessionFacts): Promise<GeneratedUnderstanding>;
}

// Own block at the end of the file on purpose (S2-T6): a second in-flight task (S2-T4) touches
// this same file's earlier interfaces, and D-022/D-025 already established the pattern (see the
// `GitFacts` import comment above) of keeping an addition self-contained, appended after
// everything that exists already, to reduce merge collisions instead of inserting mid-file.

/**
 * One fork's cleanup outcome (D-012, S2-T6) — only ever produced for a `sessionId` this port's
 * implementation already decided is stale (`core/fork-cleanup.ts#planForkCleanup`); a fork that's
 * still within `forkCleanupDays` never appears here at all.
 *
 * A discriminated union, not one shape with an optional `reason` (D-024): `reason` only exists to
 * explain a `failed` outcome, and a type that let `deleted`/`alreadyAbsent` carry one too would
 * make "was there a reason or not" representable when it never should be.
 *
 * - `deleted` — the fork's transcript file existed under `~/.claude/projects/` and was removed.
 * - `alreadyAbsent` — no such file was found. Not an error (D-025): the user may have deleted it
 *   by hand, and D-012's exception exists to guard against rediscovery, which nothing left on
 *   disk can trigger anyway. Same outcome whether the file never existed or vanished mid-attempt.
 * - `failed` — deletion was attempted and a real error stopped it (permission denied, a locked
 *   file). Named with the raw error so it stays diagnosable (AGENTS.md § "Mensagens de erro").
 */
export type ForkCleanupOutcome =
  | { readonly sessionId: string; readonly outcome: 'deleted' }
  | { readonly sessionId: string; readonly outcome: 'alreadyAbsent' }
  | { readonly sessionId: string; readonly outcome: 'failed'; readonly reason: string };

/**
 * `ForkCleanup.checkForkActivity()`'s return shape (V2-T32) — a cheap `stat` of a fork's own
 * transcript file, never its content. `notFound` (D-025: no `.jsonl` at all, never read as "it
 * never grew") is its own case, not a `null` field on `found`, so a caller can never mistake "we
 * don't know" for "we checked and it's unchanged" — `core/adopted-copy-growth.ts
 * #decideAdoptedCopyGrowth` is what turns this into that decision.
 */
export type ForkActivityCheck =
  | { readonly kind: 'notFound' }
  | { readonly kind: 'found'; readonly lastWrite: Date; readonly sizeBytes: number };

/**
 * `ForkCleanup.cleanup()`'s return shape — D-022's "both sides" applied to a deletion pass instead
 * of a validation pass: `outcomes` is what happened to every stale fork attempted (one failure
 * never stops the others, AGENTS.md D-022), and `rejected` is `forks.json`'s own D-022 contract
 * (a malformed entry in the registry itself, reported and dropped, never silently lost) — reusing
 * `RejectedDiscoveryRecord`'s shape rather than inventing a fourth one for the same
 * `file`/`raw`/`reason` triple this file already declares three times over.
 */
export interface ForkCleanupResult {
  readonly outcomes: readonly ForkCleanupOutcome[];
  readonly rejected: readonly RejectedDiscoveryRecord[];
}

/**
 * Deletes forks `seeya` itself created and registered (D-012) once they're older than
 * `forkCleanupDays`. Implemented in `adapters/discovery/` (S2-T6) — the same adapter that already
 * owns `forks.json`'s reader (`fork-registry.ts`, S1-T3) and the transcript-file lookup
 * (`transcript-lookup.ts`, S1-T4) this port's implementation reuses to find each fork's file.
 *
 * **The one port whose implementation is allowed to delete a file outside `~/.seeya/`.** Every
 * other adapter's writes stay inside the injected `seeyaHome` root (AGENTS.md § "Sistema de
 * arquivos"); this is D-012's single, narrow exception, and only for a `sessionId` this port's own
 * implementation already found listed in `forks.json` — never a path the caller supplies.
 *
 * Never throws on a single fork's deletion failing — that outcome is `failed`, inside the
 * returned `ForkCleanupResult`, not a rejected promise (D-022's "uma falha não aborta as outras"
 * applied to this port specifically).
 */
export interface ForkCleanup {
  cleanup(forkCleanupDays: number): Promise<ForkCleanupResult>;

  /**
   * V2-T29: deletes ONE fork's transcript file immediately, by `sessionId` — never age-based
   * (`cleanup` above is what `forkCleanupDays` drives). `application/project-adopt.ts
   * #adoptSession` is the only caller, and only for a fork it created itself moments earlier: an
   * adoption declined before the commit (V2-T29 item 2: "a cópia é apagada e nada fica
   * registrado"). Same D-012 exception `cleanup` already documents — this never touches
   * `forks.json` itself, that's `ForkRegistration.unregister`'s job, kept separate so accepting an
   * adoption can drop the registry entry WITHOUT deleting the transcript it's about to promote.
   */
  deleteFork(sessionId: string): Promise<ForkCleanupOutcome>;

  /**
   * V2-T32: `stat`s a fork's transcript file by `sessionId` alone — the SAME `locateTranscriptFile`
   * lookup `deleteFork` already uses, read instead of removed. `application/
   * project-revert-adoption.ts`'s own "did the adopted copy keep writing after being adopted" check
   * (D-047 item 6): a promoted fork is no longer listed in `forks.json`, so this never reads that
   * registry either — same reasoning `deleteFork`'s own docstring already gives for going straight
   * to the filesystem by id.
   */
  checkForkActivity(sessionId: string): Promise<ForkActivityCheck>;
}

/**
 * The day's consolidated document (docs/ESPECIFICACAO.md § "Glossário": "Documento consolidado do
 * dia, com todos os handoffs, lido no dia seguinte") — `Storage.readBriefing()`'s return shape
 * (S3-T1). Distinct from `~/.seeya/days/<day>/summary.md`'s markdown rendering
 * (`core/briefing.ts#generateBriefingMarkdown`, S2-T4): that's one human-readable *display* of
 * this same data, built for `seeya end-day`'s own output. `seeya start-day` (S3-T1) needs the
 * *structured* form instead — `pendingItems`/`tomorrowPlan`/`understanding` per session live on
 * each `Handoff`, and there is nowhere in prose to parse them back out of (same shape of
 * divergence from `docs/ARQUITETURA.md` § "Portas"'s sketch already recorded for
 * `DiscoveryResult`/`TranscriptReadResult`/`GitReadResult`/`readHandoff`, Q-012/Q-014/Q-019/
 * Q-021 item 4). Built directly on top of `Storage.listHandoffs(day)`, which already does the
 * real work — this is that same `{ handoffs, rejected }` shape with `day` attached, not a second
 * read path or a second on-disk format.
 *
 * Declared after `Storage` on purpose: `Storage.readBriefing` above references it, and nothing in
 * TypeScript requires a type to appear before an interface member that uses it — moving this
 * wouldn't change what either declares. (Was briefly a second `export interface Storage {}` block
 * here too, merged back into the single interface above — see docs/FLUXO-DE-AGENTES.md's note on
 * why "aditivo no fim do arquivo" produced that split for a method added to an EXISTING interface,
 * and docs/PLANO-DE-ENTREGA.md S3-T3 for the consolidation.)
 */
export interface Briefing {
  readonly day: Day;
  readonly handoffs: readonly Handoff[];
  readonly rejected: readonly RejectedDiscoveryRecord[];
}

// Own import line on purpose (S3-T2), same pattern the `GitFacts` import above already
// established: keeps this addition self-contained instead of folding into the top import block.
import type { PrimaryResumeAttempt, ResumeFallbackReason, ResumeOutcome } from './types.js';

/**
 * Resumes one session interactively, or reports that a fresh session would be needed instead
 * (D-004). Implemented in `adapters/resumption/` (S3-T2) — spawns `claude` with the child's stdio
 * **inherited** from `seeya`'s own process, never piped. docs/spikes/H-retomada-interativa.md
 * measured that without a real terminal attached, "interactive" `claude` silently degrades into a
 * single non-interactive reply and exits — never a resumable session at all — so a genuine
 * continuation is only possible by handing the child the user's actual terminal.
 *
 * **Split into two methods since S5-T9, not one `resume()`.** The original shape decided AND
 * executed the fallback in the same call, which left no room for `application/start-day.ts` to ask
 * the person first — and the 2026-09-13 case this task exists to close was exactly that: someone
 * only learned a fresh, history-less session had opened by reading the summary printed at the very
 * end, from inside that same session. Now the decision to actually open the fallback belongs to
 * the caller, informed by a person's answer, never to this port.
 *
 * `prompt` is `seeya`'s already-assembled first message for this session — S3-T1's job (reading
 * the pending briefing, building the per-session text). This port doesn't know or care what a
 * `Handoff`/`Briefing` looks like; it only ever receives a plain string, which keeps this
 * adapter's one technical concern (how to get variable-length text into an interactive `claude`
 * process, D-015) separate from what that text says.
 */
export interface SessionResumer {
  /**
   * Tries the original session. Resolves once `claude --resume` either attaches for real (there is
   * no event that fires any sooner than the user's own `/exit`, Ctrl+D, or closing the window — this
   * port never gets the child's stdout/stderr, which went straight to the real screen the user is
   * already looking at) or fails fast/would exceed the argument size ceiling — in which case this
   * NEVER spawns the fallback itself, it only reports why one would be needed.
   */
  attemptResume(sessionId: string, cwd: string, prompt: string): Promise<PrimaryResumeAttempt>;

  /**
   * Actually opens the fallback session — called only after the caller has decided to (S5-T9: after
   * asking the person, with "skip" as the default answer). `reason` is whatever
   * `attemptResume`'s `needsFallback` reported; this method doesn't recompute it, so the message
   * shown to the person and the fallback actually run can never name two different reasons.
   */
  runFallback(
    sessionId: string,
    cwd: string,
    prompt: string,
    reason: ResumeFallbackReason,
  ): Promise<ResumeOutcome>;

  /**
   * Tries the original session again, WITHOUT the plan as an argument at all (V2-T7 item 2) — only
   * ever called after the caller decided to, from a `promptTooLarge` fallback question answered
   * "resume without the plan" (`FallbackDecision.kind === 'resumeWithoutPlan'`,
   * `core/resume-fallback-decision.ts`). Same fast-failure detection as `attemptResume`: this port
   * gets no stdout/stderr from the child (`stdio: 'inherit'`), so a genuine interactive session and
   * one that never really opened are told apart the same way, by how long the process stayed up.
   *
   * Returns `PrimaryResumeAttempt` — the SAME result shape `attemptResume` uses — but see that
   * type's own docstring for how the two branches differ here: a `resumed` outcome's `outcome`
   * field is only a bare `{ kind: 'resumed' }` signal (this method has no `prompt` to measure a
   * length from, so it cannot itself build the full `resumedWithoutPlan` `ResumeOutcome` — the
   * caller does, from the `promptTooLarge` reason it already has); a `needsFallback` reason is
   * always `{ kind: 'resumeWithoutPlanFailed' }`, never `resumeFailed`/`promptTooLarge` — those
   * only ever come from `attemptResume`. A `needsFallback` result here is never asked about again
   * (docs/PLANO-DE-ENTREGA.md V2-T7 item 2: "sem segunda pergunta") — the caller reports the
   * session skipped, with that exit code, and moves on to the next one.
   */
  resumeWithoutPrompt(sessionId: string, cwd: string): Promise<PrimaryResumeAttempt>;
}

// Own block at the end of the file on purpose (S4-T1), same pattern `ForkCleanup`/`Briefing`/
// `SessionResumer` above already established (see their own comments): a new interface, appended
// rather than inserted mid-file, to reduce merge collisions — S4-T2 (`core/schedule.ts`) is a
// second in-flight task, and its own edits to this file are limited to this file's top comment.

/**
 * A minimal notice to show outside the terminal (docs/ESPECIFICACAO.md § "Notificações"). Title
 * and body only — no actions. Spike B (docs/spikes/B-notificacoes.md) measured that action
 * buttons are inconsistent across the three OSes and expensive on two of them (a registered COM
 * server, or an external binary that "pode não estar instalado"); docs/ESPECIFICACAO.md's answer
 * is that no use case ever depends on a click — every notice already names the equivalent command
 * in `body` ("seeya snooze +30m"), and a click, where it turns out to be cheap and reliable, is
 * added later as a pure convenience, never the only path (docs/PLANO-DE-ENTREGA.md S4-T1).
 */
export interface Notice {
  readonly title: string;
  readonly body: string;
}

/**
 * Shows `notice` outside the terminal. Implemented in `adapters/notification/` (S4-T1) as a
 * fallback chain over native-OS backends, degrading to stderr as the guaranteed last resort
 * (docs/spikes/B-notificacoes.md § "Cadeia de fallback proposta", docs/TESTES.md § "Cadeia de
 * fallback do notificador": "primeiro disponível vence; nenhum disponível cai para stderr sem
 * lançar").
 *
 * **Never rejects.** A notification is a courtesy, never the product — the same discipline D-003
 * already applies to a failed generation, applied here to the notice about the day's own result
 * (docs/ESPECIFICACAO.md § `seeya end-day`: notifying is step 5, after the handoff is already
 * written and verified, and after termination already ran or didn't). A caller (`cli/`) never
 * needs a `try`/`catch` around `notify()` — every concrete backend's own failure is caught inside
 * the adapter's fallback chain before it ever reaches this port's caller.
 */
export interface Notifier {
  notify(notice: Notice): Promise<void>;
}

// Own block at the end of the file on purpose (S5-T1), same pattern `Notifier`/`SessionResumer`
// above already established: a new interface, appended rather than inserted mid-file.

/**
 * `Autostart.status()`'s return shape — the four states docs/PLANO-DE-ENTREGA.md S5-T1 names,
 * never flattened into "is something registered or not" (D-024):
 * - `enabled` — registered, and the path it points at still exists on disk.
 * - `disabled` — nothing registered on this machine.
 * - `brokenPath` — registered, but the recorded path no longer exists. Not hypothetical: the
 *   2026-09-13 project folder rename (docs/PLANO-DE-ENTREGA.md S5-T0) is the real case.
 * - `unknown` — the OS query itself failed (permission denied, the OS tool missing) — D-025:
 *   neither "on" nor "off" is something this call actually knows, so neither is claimed.
 */
export type AutostartStatus =
  | { readonly kind: 'enabled'; readonly registeredPath: string }
  | { readonly kind: 'disabled' }
  | { readonly kind: 'brokenPath'; readonly registeredPath: string }
  | { readonly kind: 'unknown'; readonly error: string };

/**
 * `Autostart.enable()`'s return shape (S5-T1's cuidado (f)): "enable diz o que registrou;
 * repetido, diz que já existia e o que mudou (caminho antigo vs. novo), sem duplicar."
 */
export type AutostartEnableResult =
  | { readonly kind: 'registered'; readonly path: string }
  | { readonly kind: 'alreadyRegistered'; readonly path: string }
  | { readonly kind: 'updated'; readonly previousPath: string; readonly newPath: string };

/** `Autostart.disable()`'s return shape. Never an error to disable something already off
 * (D-025) — same "already gone is not an error" contract `Storage.clearDaemonLock` documents. */
export type AutostartDisableResult =
  { readonly kind: 'removed' } | { readonly kind: 'notRegistered' };

/**
 * `Autostart.enable()`'s optional second argument (V2-T13, D-045 item 4). Every field defaults to
 * this task's own pre-existing behavior when omitted: `execPath` to `process.execPath` read
 * inside the adapter (unchanged since S5-T1 — the CLI's own `execPath` genuinely IS a plain Node
 * binary, nothing to override), `env` to none. The interface's own composition root
 * (`packages/app/src/composition/index.ts`) is the one real caller that ever passes either: its
 * `process.execPath` is the Electron binary, not Node, so registering the app's own daemon in
 * autostart needs BOTH `execPath` set to that binary AND `env` carrying
 * `ELECTRON_RUN_AS_NODE: '1'` (Electron's own documented mechanism for making it behave as plain
 * Node) — the exact same two facts `adapters/process/daemon-launch.ts#DaemonLaunchTarget` already
 * carries for the "Start daemon" button, reused here rather than a second, independent pair of
 * fields (a caller building a `DaemonLaunchTarget` already satisfies this shape structurally,
 * `nodePath` read as `execPath`).
 */
export interface AutostartLaunchOptions {
  readonly execPath?: string;
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Registers/removes/queries `seeya daemon` in the current OS's own autostart mechanism
 * (docs/PLANO-DE-ENTREGA.md S5-T1: Task Scheduler on Windows, `systemd --user` on Linux, a
 * LaunchAgent on macOS). Implemented in `adapters/autostart/`, one class per OS, picked by
 * `process.platform` in that adapter's own `index.ts` — same shape `adapters/notification/`
 * already uses for its per-OS backend choice.
 *
 * **No new key in `~/.seeya/` (D-027).** The "on/off" state lives entirely in the OS's own
 * mechanism; this port never persists anything of its own, and `status()`'s job is only ever to
 * ask the OS and report back, honestly (D-025), never to remember a previous answer.
 *
 * `enable`'s `binaryPath` is the `dist/cli/index.js` currently in use (S5-T1's cuidado (f)) —
 * `cli/index.ts` resolves it the same way `seeya daemon`'s own self-relaunch already does
 * (`fileURLToPath(import.meta.url)`), so autostart always points at the binary that registered
 * it, never a hardcoded install location. `options` is V2-T13's own addition — see
 * `AutostartLaunchOptions`'s own docstring.
 */
export interface Autostart {
  enable(binaryPath: string, options?: AutostartLaunchOptions): Promise<AutostartEnableResult>;
  disable(): Promise<AutostartDisableResult>;
  status(): Promise<AutostartStatus>;
}

// Own block at the end of the file on purpose (V2-T9 item 1), same pattern `Autostart`/`Notifier`
// above already established: a new interface, appended rather than inserted mid-file.

/**
 * Whether a directory a session once ran in still exists on this machine right now — the one
 * piece of "world" V2-T9's cwd history needs that isn't `~/.seeya/` itself (`Storage`'s own job,
 * D-027) and isn't a discovered session's own liveness (`ProcessControl`'s job): a `cwd` recorded
 * in an OLD handoff may have been renamed or deleted since (docs/PLANO-DE-ENTREGA.md V2-T9's own
 * "achado" — the maintainer's own session moved from `C:\code` to `C:\code\seeya`), and D-025
 * means that has to be checked, not assumed either way, before ever offering the directory as a
 * place to resume into (`application/cwd-history.ts`). Implemented in `adapters/filesystem/`
 * (`FsDirectoryExistence`, a plain `fs.promises.stat`).
 *
 * **Not part of `Storage`.** `Storage`'s whole contract is about `~/.seeya/`'s own documents
 * (D-027's "raiz injetável"); a session's `cwd` is an arbitrary directory this project doesn't own
 * and never writes to. Folding an unrelated existence check into `Storage` would blur that
 * boundary for one caller's convenience.
 *
 * Never throws: a path that doesn't exist, isn't a directory, or can't be statted for any reason
 * (permission denied, a component of the path removed mid-check) is `false` — same "no crash on an
 * ordinary missing path" discipline `adapters/git/canonical-path.ts#canonicalPath` already applies
 * to a comparable "is this real" question.
 */
export interface DirectoryExistence {
  exists(cwd: string): Promise<boolean>;
}

// Own block at the end of the file on purpose (V2-T13), same pattern `Autostart`/`Notifier`/
// `DirectoryExistence` above already established: a new interface, appended rather than inserted
// mid-file, to reduce merge collisions.

/**
 * `AppInstallation.find()`'s return shape (V2-T13, D-045 item 2) — a discriminated union (D-024),
 * never `{ installed: boolean; executablePath?: string }`: a Windows/Linux/macOS adapter that
 * reports "installed" always has a real path to report alongside it, so the type doesn't leave
 * room for the pair to disagree.
 * - `installed` — the OS's own installation record for this app exists; `executablePath` is what
 *   that record itself names (Windows: derived from the per-user uninstall entry's own
 *   `InstallLocation`/`UninstallString`; Linux: `dpkg`'s own file list for the package; macOS: the
 *   `.app` bundle's own `Contents/MacOS/<executableName>`).
 * - `notInstalled` — the OS's own record was asked and genuinely says no (Windows: no matching
 *   uninstall entry; Linux: `dpkg` reports the package not installed, which is also what an
 *   `AppImage` run naturally gets — it never touches `dpkg`'s database in the first place, so
 *   nothing in this adapter has to special-case it, D-045's own "AppImage nunca é dono" falls out
 *   of the query itself; macOS: no `.app` bundle at the expected path).
 * - `unknown` — the OS QUERY ITSELF failed (permission denied, the OS tool missing, a malformed
 *   answer) — D-025: neither "installed" nor "not installed" is something this call actually
 *   knows, so neither is claimed. `application/daemon-ownership.ts#resolveDaemonOwner` is what
 *   turns this into a `DaemonOwner`, and its own docstring has the "unknown never blocks" rule
 *   this state exists to feed.
 */
export type AppInstallationStatus =
  | { readonly kind: 'installed'; readonly executablePath: string }
  | { readonly kind: 'notInstalled' }
  | { readonly kind: 'unknown'; readonly error: string };

/**
 * Whether `seeya` the app (not the CLI) is installed on this machine, asked of the OS's OWN
 * installation record — never a file this project writes itself (D-045 item 2's own reasoning:
 * "opções assim disponíveis para alguém ir lá e apagar são um problema"; the marker in
 * `~/.seeya/` stays reserved for USE state, like `protocol-handler.json` already is, never for
 * ownership). Implemented in `adapters/installation/`, one class per OS, picked by
 * `process.platform` in that adapter's own `index.ts` — same per-OS-adapter shape
 * `adapters/autostart/` already uses.
 *
 * **Only Windows was measured on the machine this task shipped from (docs/QUESTOES.md Q-081).**
 * Linux/macOS follow the mechanisms D-045 item 2 names (`dpkg`, `/Applications`) without being
 * run against a real `.deb` install or a real `.app` bundle — same "not measured" disclaimer
 * `adapters/autostart/linux.ts`/`macos.ts` already carry for the identical reason (S5-T1).
 */
export interface AppInstallation {
  find(): Promise<AppInstallationStatus>;
}

/**
 * V2-T27: write access to the workspace — the single git repository `docs/V2-RUMO.md` § "Um
 * repositório para todos os projetos" describes, holding every project as a subdirectory.
 * Implemented by `adapters/workspace/index.ts#FsWorkspaceRepository`, over the SAME `runGit`
 * (`adapters/git/run-git.ts`) `GitReader` already uses — reused, not a new git dependency
 * (`docs/PLANO-DE-ENTREGA.md`'s own instruction: "para git, o projeto já tem um adaptador —
 * reuse"). Deliberately separate from `GitReader`: that port reads facts about a SESSION's own
 * repository (never writes); this one writes to the workspace `seeya` itself owns — two different
 * repositories, two different responsibilities, same underlying `git` binary.
 *
 * Also separate from `Storage`: `Storage`'s whole contract is `~/.seeya/` (D-027); the workspace
 * is a second, distinct root a `seeya project` command is allowed to write inside
 * (`docs/PLANO-DE-ENTREGA.md`: "escrever só dentro do espaço de trabalho e de `~/.seeya/`") — its
 * own root path happens to default INSIDE `~/.seeya/` (`Storage.readWorkspaceRoot`'s own
 * docstring), but is not assumed to be there by anything in this port.
 *
 * Every method takes `root` explicitly (never reads `Storage` itself) — same reasoning
 * `GitReader.readFacts(cwd: string)` already follows: the port stays a pure "operate on this
 * directory" contract, and `application/workspace.ts` is the one layer that resolves which
 * directory that is.
 */
export interface WorkspaceRepository {
  /** True when `root` is already a git working tree (has a `.git` entry) — never creates
   * anything; false both when `root` doesn't exist yet and when it exists but isn't a repository
   * yet, the two situations `application/workspace.ts#createProject` treats identically (both mean
   * "call `initialize` first"). */
  isInitialized(root: string): Promise<boolean>;

  /** `git init` at `root`, creating `root` itself first if it doesn't exist. Only ever called
   * after `isInitialized` reported false — this method doesn't re-check on its own, the same
   * "caller already knows" contract `ProcessControl.terminateGracefully`'s neighbors follow. */
  initialize(root: string): Promise<void>;

  /** True when `root/projectId` already holds a `seeya.json` — the same test `listProjects`
   * below uses to decide what counts as a project, so a directory a person created by hand for
   * some other reason is never mistaken for one (D-025: no `seeya.json`, no claim either way about
   * "is this a project"). */
  projectExists(root: string, projectId: string): Promise<boolean>;

  /**
   * Writes every file and creates every directory `skeleton` describes
   * (`core/project-skeleton.ts#buildProjectSkeleton`), relative to `root/projectId`, plus
   * `root/projectId/seeya.json` itself, serialized from `skeleton.manifest` with the adapter's own
   * `schemaVersion` (the same split `Storage.saveConfig` already draws between `Config`, the
   * domain type, and `config-schema.ts`, the on-disk shape). Each file is written atomically
   * (`adapters/storage/atomic-write.ts#writeFileAtomic`, reused — same "temporário + rename"
   * AGENTS.md requires for `~/.seeya/`, applied here to the workspace instead). Never commits —
   * `commitAll` below is a separate, explicit step, so a caller can write several projects (or a
   * project plus an unrelated change) before choosing to commit once.
   */
  writeProjectSkeleton(root: string, projectId: string, skeleton: ProjectSkeleton): Promise<void>;

  /**
   * V2-T28: overwrites `root/projectId/seeya.json` alone with `manifest` — everything else the
   * skeleton wrote (`AGENTS.md`, the six empty directories, etc.) is untouched. `addRepository`
   * (`application/repository-association.ts`) is the one caller: read the manifest, append the new
   * `AssociatedRepository`, write it back, `commitAll` — the same read-modify-write-commit shape
   * `writeProjectSkeleton` + `commitAll` already give `createProject`, minus the skeleton files a
   * project already has by the time this runs. Never called for a project that doesn't exist yet
   * (`writeProjectSkeleton` is that path); this port doesn't re-check `projectExists` on its own,
   * same "caller already knows" contract this interface's other methods already follow.
   */
  writeProjectManifest(root: string, projectId: string, manifest: ProjectManifest): Promise<void>;

  /**
   * `git add -A && git commit -m message` at `root`, using `seeya`'s own author/committer identity
   * (never the operator's real `git config user.*` — the same reasoning
   * `tests/integration/git/_fixtures.ts#commitAt` already documents for why a commit's identity
   * shouldn't depend on whatever happens to be configured on the machine running it). **A no-op,
   * not an empty commit, when nothing is staged after `git add -A`** — `application/
   * workspace.ts#createProject` calls this right after `writeProjectSkeleton`, but a future
   * caller re-running the same operation idempotently (nothing changed) must not grow the
   * workspace's history with a commit that carries no diff.
   */
  /**
   * V2-T33: `projectId`, added so this method can scope `git add` to just that project's own
   * directory (plus `.gitignore`, reasserted right before — see the adapter's own comment) instead
   * of `git add -A` across the whole workspace (D-047 item 3's own bug fix: mixed-in pending
   * changes from a second project used to ride along on whichever project committed first, which
   * made reverting one project's commits also undo the other's). `message` arrives fully built —
   * `core/project-commit.ts#buildProjectCommitMessage` already folded in both D-047 item 4
   * trailers — so this method's only job is to run git, never to assemble trailer text itself.
   *
   * `lockHolder` (V2-T34 hotfix, PO review 2026-09-25): supplied by every caller that's committing
   * WHILE holding the touched project's own lock (`application/project-open.ts`'s own
   * leftover-changes commit, `project-adopt.ts`, `project-remove.ts`, `project-remove-repo.ts` —
   * their own `deps.pid`/`deps.procStart`, the SAME pair each already wrote into `.seeya-lock`).
   * Folded into the spawned `git commit`'s own environment
   * (`adapters/workspace/lock-holder-env.ts#buildLockHolderEnv`) so the workspace's own commit-msg
   * hook can authorize it without a matching `CLAUDE_CODE_SESSION_ID` — `core/
   * workspace-commit-guard.ts`'s own docstring has the full reasoning for why session id alone
   * can't. `undefined` for `createProject`/`addRepository`, which never take a lock at all.
   */
  commitAll(
    root: string,
    projectId: string,
    message: string,
    lockHolder?: LockHolderProcess,
  ): Promise<void>;

  /**
   * D-022's "both sides", for the workspace's own collection of projects: every immediate
   * subdirectory of `root` holding a `seeya.json` that parses, plus every one that doesn't (bad
   * JSON, a schema mismatch, an unsupported `schemaVersion`) as a `RejectedDiscoveryRecord` — same
   * shape `Storage.listHandoffs` already returns for the identical reason. A subdirectory with NO
   * `seeya.json` at all (e.g. `.git` itself, or something a person created by hand) is silently
   * skipped — neither accepted nor rejected, D-025: this port makes no claim about a directory
   * that never looked like a project to begin with.
   */
  listProjects(
    root: string,
  ): Promise<{ manifests: ProjectManifest[]; rejected: RejectedDiscoveryRecord[] }>;

  /**
   * A single, explicit lookup (`seeya project show <id>`) — unlike `listProjects`, this is NOT a
   * collection scan, so D-022's per-item tolerance doesn't apply: a malformed `seeya.json` throws
   * (same split `Storage.readHandoff`/`listHandoffs` already draw for the identical reason, see
   * that adapter's own docstring). `null` only when `root/projectId` has no `seeya.json` at all
   * (D-025: the project genuinely doesn't exist, not a parse failure).
   */
  readProjectManifest(root: string, projectId: string): Promise<ProjectManifest | null>;

  /**
   * V2-T29: the project's own uncommitted changes, scoped to `root/projectId` only — the same
   * `git add <projectId>` scoping `commitAll` already uses (D-047 item 3), read instead of
   * written. `application/project-adopt.ts#adoptSession` calls this right after the interactive
   * fork session closes, to show the person what it wrote before asking whether to commit (V2-T29
   * item 4: "nada é commitado sem a pessoa"). One path per changed/added/removed file, relative to
   * `root` (git's own `status --porcelain` output, unparsed beyond stripping the two-character
   * status prefix) — empty when the session wrote nothing, which `adoptSession` reads as "nothing
   * to confirm".
   */
  listChangedFiles(root: string, projectId: string): Promise<readonly string[]>;

  /**
   * V2-T32: deletes `root/projectId` recursively — `seeya project remove`'s own physical removal.
   * Never commits (`commitAll`, right after, is the separate, explicit step every other mutating
   * method here already keeps distinct) and never touches anything outside `root/projectId` itself
   * — an associated repository, a discovered session, a transcript, all live elsewhere and this
   * method has no path to reach any of them (`docs/PLANO-DE-ENTREGA.md` V2-T32 item 4).
   */
  removeProjectDirectory(root: string, projectId: string): Promise<void>;

  /**
   * V2-T32: the workspace's current `HEAD` commit hash, or `null` when it has no commits yet
   * (D-025) — `application/project-remove.ts`'s own "how to recover" line: the commit right BEFORE
   * a removal is simply whatever `HEAD` already was the moment before that removal's own commit.
   */
  currentCommit(root: string): Promise<string | null>;

  /**
   * V2-T32: how many files `root/projectId` currently holds under version control (`git ls-files`,
   * scoped the same way `listChangedFiles`/`commitAll` already scope their own git calls) —
   * `seeya project remove`'s own confirmation prompt ("this removes N files").
   */
  countProjectFiles(root: string, projectId: string): Promise<number>;

  /**
   * V2-T32: every commit inside `root/projectId`'s own history carrying `Seeya-Session-Id:
   * <sessionId>` (`core/project-commit.ts#SESSION_ID_TRAILER_KEY`, the trailer `commitAll` writes
   * on every project commit, D-047 item 4) — oldest first (`git log --reverse`), each with the
   * files IT changed (scoped to `projectId`, same as `commitAll`'s own `git add`, so a workspace
   * -wide file like `.gitignore` never counts as "touched" by a project's own session). Empty when
   * the session never committed inside this project at all (D-025) —
   * `application/project-revert-adoption.ts`'s own "nothing to revert" case, never an error.
   */
  findSessionCommits(
    root: string,
    projectId: string,
    sessionId: string,
  ): Promise<readonly RevertCommitInfo[]>;

  /**
   * V2-T32: every commit inside `root/projectId`'s own history strictly AFTER `afterCommit`, oldest
   * first, each with the files it changed (same `projectId`-scoping as `findSessionCommits`) —
   * `application/project-revert-adoption.ts`'s own "did anything else touch these files since"
   * check (`core/project-revert.ts#planAdoptionRevert`), the pre-check D-047 item 4 requires before
   * ever running `git revert`.
   */
  findCommitsAfter(
    root: string,
    projectId: string,
    afterCommit: string,
  ): Promise<readonly RevertCommitInfo[]>;

  /**
   * V2-T32: reverts `commitsNewestFirst` (already ordered newest → oldest by the caller,
   * `core/project-revert.ts#planAdoptionRevert`'s own `commitsNewestFirst`) with `git revert
   * --no-commit --no-edit`, one at a time, then a SINGLE commit with `message` (already carrying
   * both D-047 item 4 trailers, `core/project-commit.ts#buildProjectCommitMessage` — this method
   * never assembles trailer text itself, same split `commitAll` already draws). Stops at the first
   * commit that fails to apply cleanly and runs `git revert --abort` before returning `failed` —
   * "nunca reverte pela metade" applied to git's own mechanics, not just this port's own pre-check:
   * every commit here belongs to ONE session that held the project lock alone (D-047), so a clean
   * sequential revert is the expected case; `failed` is the safety net for the unexpected one.
   * `noChanges` is the rarer edge case where the reverts cancel out to a net-zero diff against
   * `HEAD` (same "no-op, not an empty commit" contract `commitAll` already has).
   *
   * `lockHolder` (V2-T34 hotfix): same meaning and same caller obligation as `commitAll`'s own —
   * `application/project-revert-adoption.ts`'s own `deps.pid`/`deps.procStart`.
   */
  revertCommits(
    root: string,
    projectId: string,
    commitsNewestFirst: readonly string[],
    message: string,
    lockHolder?: LockHolderProcess,
  ): Promise<RevertExecutionOutcome>;

  /**
   * V2-T34 item 1: `git diff --cached --name-only`, workspace-relative and UNSCOPED — the guard
   * (`core/workspace-commit-guard.ts`) needs to see every staged file, across every project, to
   * refuse a commit that touches more than one. Called by `application/verify-commit.ts` from
   * inside the workspace's own `commit-msg` hook, always with `root` as the hook's own `cwd` (git
   * runs every hook at the top of the working tree).
   */
  listStagedFiles(root: string): Promise<readonly string[]>;

  /**
   * V2-T34 item 1: writes `<root>/.git/hooks/commit-msg` (D-047 item 5's own "ganchos de git...
   * instalados e reafirmados pelo seeya") and marks it executable. Called once at
   * `application/workspace.ts#createProject` (right after `initialize()`) and again at the start of
   * every `application/project-open.ts#openProject` — "um gancho apagado volta sozinho." Always
   * overwrites: this hook is `seeya`'s own generated text, never something a person is expected to
   * hand-edit (`core/workspace-hooks.ts#buildCommitMsgHookScript`'s own comment).
   */
  installCommitMsgHook(root: string, scriptContent: string): Promise<void>;

  /**
   * V2-T34 item 3: every commit inside `root/projectId`'s own history, oldest first, since
   * `sinceCommit` (exclusive) — or the WHOLE history when `sinceCommit` is `null` (no audit has run
   * for this project yet). Unlike `findSessionCommits`/`findCommitsAfter`, each commit's `files` is
   * UNSCOPED (every file it touched, in every project) — `core/project-audit.ts`'s own
   * `touchesOtherProjects` check needs to see a commit that secretly reached into a second project,
   * which a `projectId`-scoped file list would hide by construction.
   */
  listCommitsForAudit(
    root: string,
    projectId: string,
    sinceCommit: string | null,
  ): Promise<readonly AuditableCommit[]>;

  /**
   * V2-T34 item 2 (PO review): writes `<root>/<projectId>/.claude/settings.json` — the Claude Code
   * project hook (`core/harness-hook-config.ts`). Called at the start of every
   * `application/project-open.ts#openProject`, the SAME "reinstalled by every open" discipline
   * `installCommitMsgHook` above already has, for the identical reason: the content embeds this
   * machine's current, absolute `seeya` path, which only `open` can know is fresh. Never
   * committed — the workspace's own `.gitignore` excludes every project's own `.claude/` directory
   * (`adapters/workspace/index.ts`'s own gitignore reassertion, extended to cover this).
   */
  installHarnessHook(root: string, projectId: string, settingsJsonContent: string): Promise<void>;
}

/**
 * `WorkspaceRepository.findSessionCommits`/`findCommitsAfter`'s own return shape (V2-T32) — one
 * commit's hash plus the files IT changed, scoped to one project. `core/project-revert.ts
 * #planAdoptionRevert` is the one (pure) consumer, comparing `files` across two of these lists to
 * decide whether reverting is safe.
 */
export interface RevertCommitInfo {
  readonly hash: string;
  readonly files: readonly string[];
}

/**
 * `WorkspaceRepository.revertCommits()`'s own outcome (V2-T32) — a discriminated union, not a bare
 * boolean (D-024): `failed` names the one commit that didn't apply cleanly, so a refusal message
 * can say exactly where the sequence stopped, not just that it did.
 */
export type RevertExecutionOutcome =
  | { readonly kind: 'committed' }
  | { readonly kind: 'noChanges' }
  | { readonly kind: 'failed'; readonly hash: string; readonly reason: string };

/**
 * `HarnessLauncher.open()`'s own outcome (V2-T28) — a discriminated union, not a bare exit code
 * with a magic sentinel (D-024, same reasoning `adapters/git/run-git.ts#GitCommandResult` already
 * applies): `failedToStart` is "the process never ran at all" (missing binary, missing `cwd`);
 * `opened` is "it ran, for however long, and closed" — `exitCode` is whatever it closed with, not
 * itself a success/failure signal (the harness is a real interactive session; a person typing
 * `/exit` seconds in is not a failure this port has any business judging).
 */
export type HarnessOpenResult =
  { readonly kind: 'opened'; readonly exitCode: number } | { readonly kind: 'failedToStart' };

/**
 * V2-T28: opens a harness fresh (never `--resume` — that's `SessionResumer`'s job) in a project's
 * own directory, with every associated repository still resolvable on this device released via
 * `--add-dir` — `docs/PLANO-DE-ENTREGA.md` V2-T28 item 3, `docs/V2-RUMO.md` § "Abertura das
 * sessões": "No começo, `open` só executa o CLI do harness escolhido com o projeto como diretório
 * de trabalho." `application/project-open.ts#openProject` is the one caller, and decides BEFORE
 * calling this port whether the requested harness is supported at all (item 5: only `claude` this
 * task) — this port has exactly one implementation
 * (`adapters/harness/index.ts#ClaudeHarnessLauncher`), so it never takes a harness name.
 *
 * Same `stdio: 'inherit'` contract `SessionResumer` already established
 * (docs/spikes/H-retomada-interativa.md) — `open` is a genuine interactive session too, never
 * headless.
 *
 * **`sessionId`/`systemPromptAppend` (V2-T35 items 2/4).** `sessionId` is generated by the
 * composition root (`packages/cli/src/composition.ts#buildProjectOpenDeps`, `node:crypto
 * #randomUUID` — randomness stays out of `core/`/`application/`) and passed straight through as
 * `claude --session-id <sessionId>`, confirmed to create a fresh session under that exact id
 * (`docs/spikes/J-cache-na-captura.md`). `systemPromptAppend` is `null` when there is nothing
 * noteworthy about the lock (a genuinely free acquisition never warns), or the SAME text
 * `cli/format-project.ts` prints to the terminal (`core/project-lock-message.ts
 * #formatProjectLockWarningLines`) when there is — delivered as `--append-system-prompt <text>`,
 * confirmed to reach a FRESH session's system prompt (unlike a RESUMED one, Q-069's own measured
 * "não entrega" is specific to `--resume`; `open` never resumes).
 */
export interface HarnessLauncher {
  open(
    cwd: string,
    addDirs: readonly string[],
    sessionId: string,
    systemPromptAppend: string | null,
  ): Promise<HarnessOpenResult>;
}

// Own block at the end of the file on purpose (V2-T33), same pattern `HarnessLauncher`/
// `AppInstallation` above already established: a new interface, appended rather than inserted
// mid-file, to reduce merge collisions.
import type { ProjectLockInfo } from './project-lock.js';

/**
 * D-047 item 1: reads/writes/clears `.seeya-lock`, the project lock — a file INSIDE
 * `root/projectId` (never `~/.seeya/`, never committed, `AGENTS.md`'s own glossary entry).
 * Implemented by `adapters/workspace/project-lock.ts#FsProjectLock`, atomically
 * (`adapters/storage/atomic-write.ts#writeFileAtomic`, reused).
 *
 * **Dumb I/O only — the accept/refuse decision is NOT this port's job.**
 * `core/project-lock.ts#decideProjectLockAcquisition` is what turns `read()`'s result plus a
 * separate `ProcessControl.isAlive` call into that decision (same split `Storage.readDaemonLock` +
 * `core/daemon-lock.ts#decideLockAcquisition` already draw for the daemon's own lock);
 * `application/project-lock.ts` is where the two meet.
 *
 * Deliberately its own port, not three more methods on `WorkspaceRepository`: that port's whole
 * contract is about the workspace's COMMITTED content (`commitAll`'s own docstring); the project
 * lock is operational state that must never reach a commit at all, and giving it a separate port
 * makes "this never touches git" a fact about the type, not just a comment on three of
 * `WorkspaceRepository`'s methods.
 */
export interface ProjectLock {
  /** `null` when no lock has ever been taken for this project (D-025) — not an error. */
  read(root: string, projectId: string): Promise<ProjectLockInfo | null>;
  /** Unconditionally overwrites `.seeya-lock` with `lock` — called once, right after
   * `core/project-lock.ts#decideProjectLockAcquisition` returns `'acquire'`
   * (`application/project-lock.ts#acquireProjectLock`). Not a create-if-absent primitive; the
   * accept/refuse decision already happened by the time this runs, same contract
   * `Storage.writeDaemonLock` already documents for itself. */
  write(root: string, projectId: string, lock: ProjectLockInfo): Promise<void>;
  /** Removes `.seeya-lock`, tolerating it already being absent (D-025: releasing a lock that was
   * never taken, or was already released, is not an error) — called on `seeya project open`'s own
   * clean exit, after the harness process closed. */
  clear(root: string, projectId: string): Promise<void>;
}

// Own block at the end of the file on purpose (V2-T29), same pattern `ProjectLock`/`HarnessLauncher`
// above already established.

/**
 * V2-T29: add/remove one `sessionId` in `forks.json` (D-012) from `application/`, which can't
 * import `adapters/discovery/fork-registry.ts` directly (the layer matrix forbids
 * `application` → `adapters`, D-020). Deliberately narrow — two methods, not the read/cleanup
 * surface `ForkCleanup` already owns — `application/project-adopt.ts#adoptSession` is the only
 * caller, and it only ever needs to hide a fork it's about to spawn (before `claude` runs, so the
 * registration survives a crash the same way `adapters/generation/fork-registration.ts#registerFork`'s
 * own docstring already argues for captures) and later remove that same entry — on decline
 * (nothing should stay registered) or on an accepted commit (a promoted fork stops being a
 * "capture fork" someone could later delete by age; it's tracked in `adoptions.json` instead,
 * `core/types.ts#AdoptionRecord`).
 *
 * Implemented by `adapters/generation/fork-registration.ts#GenerationForkRegistration`, over the
 * SAME `registerFork`/`unregisterFork` functions `deep-generator.ts` already calls directly
 * (adapter-to-adapter is allowed) — this class only exists to give `application/` a port to depend
 * on instead of that file's concrete functions.
 */
export interface ForkRegistration {
  register(sessionId: string, createdAt: Date): Promise<void>;
  unregister(sessionId: string): Promise<void>;
}

/**
 * V2-T29: `seeya project adopt <session> <projectId>`'s own harness spawn — a sibling of
 * `HarnessLauncher`, not a third method on it (`HarnessLauncher.open`'s own docstring: "never
 * `--resume` — that's `SessionResumer`'s job", and this isn't `SessionResumer` either, since it
 * also needs `--fork-session`/`--add-dir`, which no other port combines). Implemented by
 * `adapters/harness/session-adoption.ts#ClaudeSessionAdoptionLauncher`, reusing the same
 * `adapters/resumption/spawn-interactive.ts#runInteractive`/`env.ts#buildResumptionEnv` (D-017)
 * every other interactive spawn in this project already shares — never headless (`-p`):
 * D-047's own text is explicit that the maintainer chose interactive, on-the-spot approval for
 * every write, over any `--permission-mode` flag (docs/spikes/N-adocao-de-sessao.md's own
 * "A V2-T29 não pode assumir: que retomar basta para poder escrever").
 *
 * `originalSessionId` is what `--resume` looks up; `forkSessionId` is chosen by the caller BEFORE
 * calling this port (`packages/cli/src/composition.ts`, `node:crypto#randomUUID`) so it can be
 * registered in `forks.json` (`ForkRegistration.register`) ahead of the call — same ordering
 * `adapters/generation/args.ts#DeepGenerationArgsOptions.forkSessionId`'s own docstring already
 * establishes for the capture path, and confirmed for this exact three-flag combination
 * (`--resume` + `--fork-session` + `--session-id`, together with `--add-dir`) by a disposable
 * session measured while implementing this task (docs/QUESTOES.md Q-090): the fork's `.jsonl` came
 * out named exactly `forkSessionId`, and the original session's own transcript file was
 * byte-for-byte unchanged afterward.
 *
 * **`originalCwd`, not `projectDir`, is where the fork is actually resumed — a deliberate choice,
 * not an accident of `--resume`'s own search behavior (never measured either way,
 * docs/QUESTOES.md Q-090's own scope).** The maintainer's own reasoning (2026-09-24): the Claude
 * Code loads, by working directory, that directory's own `CLAUDE.md`, its auto-memory, local
 * configuration and skills — resuming in the session's OWN directory is what gives the fork all of
 * that; resumed in the project instead, it would have only the transcript. `adopt-instruction.ts
 * #buildAdoptionInstruction` asks the session to carry into the project whatever, from what's
 * locally available to it, belongs to this specific work.
 *
 * **`projectDir`, a single absolute string, not an `addDirs` list.** This flow only ever releases
 * one directory — the project's own — and `adapters/harness/adopt-args.ts#buildAdoptArgs` folds
 * this SAME value into the resumed session's first message
 * (`adopt-instruction.ts#buildAdoptionInstruction`), so the session is told exactly where it is,
 * never just "the project directory" with nothing naming it. Fixes a real gap the maintainer's own
 * acceptance run found (task-23 comment #2): the fork opens in `originalCwd`, never `projectDir`
 * — a session told to write into "the project directory" with no path attached reads that as its
 * own `cwd` and finds nothing there. `docs/spikes/N-adocao-de-sessao.md`'s own test session ran
 * FROM INSIDE the project directory, so this ambiguity never had a chance to surface in that
 * measurement. Confirmed fixed with a disposable session whose original directory is DIFFERENT
 * from the project directory (docs/QUESTOES.md Q-093): the files landed inside `projectDir`, none
 * outside it.
 */
export interface SessionAdoptionLauncher {
  adopt(
    originalCwd: string,
    projectDir: string,
    originalSessionId: string,
    forkSessionId: string,
  ): Promise<HarnessOpenResult>;
}

// Own block at the end of the file on purpose (V2-T34), same pattern every earlier "one port per
// task" addition above already established.

/**
 * V2-T34 item 1: the workspace's `commit-msg` hook's own I/O with the temp file git hands it — read
 * the draft message, write back whatever `core/workspace-commit-guard.ts#decideCommitGuard` decided
 * (unchanged, or with trailers completed). A degenerate two-method port rather than plain `node:fs`
 * calls inside `application/verify-commit.ts` directly, for the same reason every other access to
 * the world in this project goes through one (AGENTS.md § "Dependências"): it lets that
 * orchestration be tested with a fake in-memory file instead of a real temp path. Implemented by
 * `adapters/workspace/commit-message-file.ts`, plain (non-atomic) `fs` reads/writes — this file's
 * whole lifecycle already belongs to `git` itself (it deletes it once the hook exits), so there is
 * no "torn read" for a rename-based swap to protect against, unlike everything under `~/.seeya/`.
 */
export interface CommitMessageFile {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

/**
 * V2-T34 item 3: `seeya project audit <id>`'s own "since the last audit" marker — the commit hash
 * `listCommitsForAudit` should treat as `sinceCommit`. Lives INSIDE `root/projectId` (like
 * `.seeya-lock`, never `~/.seeya/`) and is never committed (the same workspace `.gitignore`
 * `ensureWorkspaceGitignoreIgnoresProjectLock` reasserts on every `commitAll` — V2-T34 extends it to
 * cover this file's own name too): it's this DEVICE's own bookkeeping of when it last looked, not
 * project content. Implemented by `adapters/workspace/project-audit-marker.ts#FsProjectAuditMarker`.
 */
export interface ProjectAuditMarker {
  /** `null` when this project has never been audited on this device (D-025) —
   * `listCommitsForAudit`'s own `sinceCommit: null` reads the WHOLE history in that case. */
  read(root: string, projectId: string): Promise<string | null>;
  write(root: string, projectId: string, commitHash: string): Promise<void>;
}
