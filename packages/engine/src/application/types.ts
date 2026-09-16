/**
 * `endDay`'s own dependency and result shapes (S2-T3, docs/ESPECIFICACAO.md § `seeya end-day`).
 * `EndDayDeps` types every collaborator as a `core/ports.ts` interface, never a concrete adapter
 * (D-020: `application/` cannot import `adapters/` — `cli/`, the only composition root, is what
 * builds the real instances and passes them in).
 */
import type {
  Clock,
  ForkCleanup,
  ForkCleanupResult,
  GitReader,
  HandoffGenerator,
  ProcessControl,
  RejectedDiscoveryRecord,
  SessionProvider,
  Storage,
  TranscriptReader,
} from '../core/ports.js';
import type {
  Day,
  DiscoveredSession,
  EndDayScope,
  Handoff,
  ResolvedEndDayScope,
  SessionListing,
} from '../core/types.js';
import type { IneligibilityReason } from '../core/eligibility.js';

/**
 * Every port `endDay` orchestrates. **Both `leanGenerator` and `deepGenerator` are required**, not
 * a single pre-chosen `HandoffGenerator` — the choice between them isn't purely a per-project
 * config value (D-011): a session with no transcript always uses the lean generator regardless of
 * `deepCapture` (D-013 — a deep `--resume` would never find it), and that decision needs the
 * session's own `hasTranscript` at hand, which only `endDay` (not `cli/`'s composition step) knows
 * per session. `cli/` (S2-T5) still names both concrete classes — D-020 isn't broken, it just
 * builds two instances instead of one and lets this use case pick between them per session.
 */
export interface EndDayDeps {
  readonly sessionProvider: SessionProvider;
  readonly transcriptReader: TranscriptReader;
  readonly gitReader: GitReader;
  readonly leanGenerator: HandoffGenerator;
  readonly deepGenerator: HandoffGenerator;
  readonly storage: Storage;
  readonly processControl: ProcessControl;
  readonly clock: Clock;
  /**
   * D-012's daily janitorial task (S2-T6, `ForkCleanup`), wired here by S2-T5 rather than left
   * dangling: `end-day` is the one routine this product already runs once a day, which is the
   * "candidato natural" the task that requested this wiring named — see `end-day.ts`'s own
   * docstring for the full reasoning and docs/QUESTOES.md for the write-up. Required, not
   * optional: D-020's whole point is that every dependency `endDay` needs is explicit and
   * injected, never a silently-skipped capability.
   */
  readonly forkCleanup: ForkCleanup;
}

/**
 * `endDay`'s own behavior switches (S2-T5, docs/ESPECIFICACAO.md § `seeya end-day`: "`--dry-run`
 * executa tudo menos escrever e terminar processos"; "`--session` limita a uma sessão"). Both
 * optional so every existing call site (unit tests, S2-T3's own acceptance) keeps compiling
 * unchanged with the real, full-day, real-write behavior it always had.
 *
 * `sessionFilter` is a plain predicate over `DiscoveredSession`, not a `sessionId`/`cwd` pair —
 * `endDay` still runs `SessionProvider.list()` itself and only narrows what it processes
 * afterward, so `application/` never needs to know `--session` accepts either an id or a `cwd`
 * (`cli/`'s job, `end-day-command.ts`) or grow a special case for two different matching rules.
 *
 * `scope` (S4-T0c) is independent of `sessionFilter` on purpose, not derived from whether it's
 * set: `sessionFilter` is an arbitrary predicate (several existing unit tests pass one without
 * exercising the `--session` feature at all — `() => false`, matching by an unrelated field), and
 * inferring "this run was narrowed" from "a predicate was passed" would make an unrelated test's
 * fixture silently start claiming a `--session`-narrowed scope it never meant to declare. `cli/`
 * (the only real production caller of a narrowed run) sets both together, consistently, from the
 * same resolved session. Optional here, unlike `core/types.ts#ResolvedEndDayScope` (never
 * optional): this is `endDay`'s own INPUT, and the ordinary "no `--session` at all" case reads
 * exactly like `dryRun`/`sessionFilter`'s own optionality above — absence here means "use the
 * full-day default", resolved inside `endDay` into a concrete, always-present
 * `ResolvedEndDayScope` (S4-T0d adds its discard counts) before it ever reaches
 * `core/briefing.ts`, which is where that type's own "never let absence mean one of the two
 * meanings" rule actually has to hold.
 */
export interface EndDayOptions {
  readonly dryRun?: boolean;
  readonly sessionFilter?: (session: DiscoveredSession) => boolean;
  readonly scope?: EndDayScope;
  /**
   * D-036: the daemon's own overdue-but-same-day case (`scheduler/poll.ts`, past
   * `Config.overdueFireThresholdMinutes` but still today) — every session is still captured
   * normally, but NONE is terminated this run, regardless of `canTerminate: true`
   * (`application/capture-session.ts#captureSession` is what actually enforces this, per session).
   * Defaults to `false` so `seeya end-day` and every existing caller keep their original behavior;
   * only the daemon's own overdue path ever sets this `true`.
   */
  readonly skipTermination?: boolean;
  /**
   * V2-T5a: an optional observer over the per-session capture loop `end-day.ts` already runs
   * under `config.captureConcurrency` — never changes the order, the concurrency, or the result
   * those calls produce (see `end-day.ts`'s own `runSession`/`emitCaptureStarted`/
   * `emitCaptureFinished`, the only three places that call this). `seeya end-day`
   * (`cli/composition.ts#buildEndDayContext`) and the daemon (`scheduler/poll.ts#buildEndDayDeps`)
   * never pass it — only `packages/app/src`'s own "End day..." button does (its own
   * `state/end-day-progress.ts` projects each event into "capturing N of M" for the panel), so it
   * has to be optional for every existing call site to keep compiling unchanged, same reasoning
   * `dryRun`/`sessionFilter`/`scope` above already give.
   */
  readonly onCaptureProgress?: (event: CaptureProgressEvent) => void;
  /**
   * V2-T5a (review fix): a preview that must not spend a real, billed model call before the
   * person has confirmed anything. `docs/ESPECIFICACAO.md` § `seeya end-day` only ever promised
   * "`--dry-run` executa tudo menos escrever e terminar processos" — for LEAN capture that has
   * always meant a real (billed) `claude -p` call still runs during a dry run
   * (`application/capture-session.ts#resolveGeneration`'s own docstring; only `deep` capture was
   * already skipped, to avoid D-012's fork-registration disk write). That is exactly right for
   * `seeya end-day --dry-run`, a command the person already decided to run — but WRONG for the
   * interface's own "End day…" preview (V2-T5a item 1), whose whole point is to be free to look
   * at before confirming anything (D-039). `skipGeneration: true` makes `captureSession` return a
   * `previewCaptureOutcome` for EVERY session regardless of capture mode, never touching
   * `deps.leanGenerator`/`deps.deepGenerator` at all — see that function's own docstring
   * (`generation-policy.ts`) for the full reasoning and the two independent cases it covers.
   *
   * **`skipGeneration: true` without `dryRun: true` is refused** (`endDay` throws before doing any
   * work) — a real run that skipped generation would persist a handoff with no understanding at
   * all, which nothing in this codebase's contract describes and nobody asked for; the combination
   * only makes sense as "preview, and don't even call the model for it".
   *
   * `seeya end-day`/the daemon never set this (`cli/composition.ts#buildEndDayContext`,
   * `scheduler/poll.ts#buildEndDayDeps`) — only `packages/app/src`'s own "End day…" preview does,
   * alongside `dryRun: true`. Defaults to `false` so every existing caller (including
   * `seeya end-day --dry-run` itself) keeps its original, real-lean-generator-call behavior.
   */
  readonly skipGeneration?: boolean;
}

/**
 * V2-T5a: one session, narrowed from `DiscoveredSession` to just what a progress display needs
 * (D-024: `CaptureProgressEvent` can't accidentally leak evidence-gathering fields like
 * `hasTranscript` this event was never meant to carry).
 */
export interface CaptureProgressSession {
  readonly sessionId: string;
  readonly cwd: string;
  readonly name: string;
}

/**
 * `captureFinished`'s own outcome — mirrors `end-day.ts`'s internal `SessionOutcome` union
 * (`captured`/`ineligible`/`failed`) exactly, since `onCaptureProgress` is emitted from the very
 * same three-way branch that already builds `EndDayResult`'s own buckets: this event can never
 * claim a fourth state `endDay` itself has no concept of (D-024).
 */
export type CaptureProgressOutcome =
  | { readonly kind: 'captured' }
  | { readonly kind: 'ineligible'; readonly reasons: readonly IneligibilityReason[] }
  | { readonly kind: 'failed'; readonly reason: string };

/**
 * V2-T5a's own progress event: `captureStarted` right before one session enters the capture
 * pipeline, `captureFinished` right after, with `index`/`total` 1-based over
 * `EndDayOptions.sessionFilter`'s own `sessionsInScope` (mirrors `application/start-day.ts
 * #ResumeProgressEvent`'s own 1-based numbering, same "N of M" reading).
 */
export type CaptureProgressEvent =
  | {
      readonly kind: 'captureStarted';
      readonly session: CaptureProgressSession;
      readonly index: number;
      readonly total: number;
    }
  | {
      readonly kind: 'captureFinished';
      readonly session: CaptureProgressSession;
      readonly index: number;
      readonly total: number;
      readonly outcome: CaptureProgressOutcome;
    };

/** One session `evaluateEligibility` (`core/eligibility.ts`) excluded, and why — the "aceitos e
 * rejeitados" half of D-022's contract applied to eligibility instead of parsing. */
export interface IneligibleSession {
  readonly sessionId: string;
  readonly cwd: string;
  readonly name: string;
  readonly reasons: readonly IneligibilityReason[];
}

/**
 * One eligible session whose capture pipeline threw before a handoff could be written — the
 * "isolamento de falha por sessão" requirement (docs/PLANO-DE-ENTREGA.md S2-T3): this session's
 * failure is recorded and `endDay` moves on to the next one, never aborting the batch.
 */
export interface CaptureFailure {
  readonly sessionId: string;
  readonly cwd: string;
  readonly name: string;
  /** AGENTS.md § "Mensagens de erro": the raw failure, not just "capture failed". */
  readonly reason: string;
}

/**
 * Q-007: `terminateGracefully` returned `false` with the process still alive, for a session
 * `canTerminate: true` opted into. Not an error and not aborted — the handoff was written
 * successfully — but silence here is exactly the failure mode Q-007 exists to prevent: whoever
 * turned `canTerminate` on believes the session closed. Named explicitly in `EndDayResult` so a
 * caller (`cli/`, S4-T1's notifier) can't miss it by only checking `failedCaptures`.
 */
export interface TerminationNotice {
  readonly sessionId: string;
  readonly cwd: string;
  readonly name: string;
  readonly reason: string;
}

/** One session that reached a written, disk-verified handoff (D-002's ordering requirement). */
export interface CapturedSession {
  readonly handoff: Handoff;
  /** Whether `ProcessControl.terminateGracefully` was called AND reported success. `false`
   * covers three different, non-error situations at once — the session wasn't opted into
   * `canTerminate`, it has no PID to terminate at all, or termination was attempted and Q-007
   * fired (see `terminationNotices` for that last one specifically). */
  readonly terminated: boolean;
}

/**
 * `endDay`'s full result (docs/PLANO-DE-ENTREGA.md S2-T3's acceptance criteria) — modeled after
 * D-022's "aceitos e rejeitados" contract, extended to every way a session can fail to become a
 * clean, terminated capture: discovery rejections, ineligibility, capture failure, and Q-007's
 * termination notices are all first-class, visible fields, never folded into a single boolean or
 * swallowed because the common case succeeded.
 */
export interface EndDayResult {
  readonly day: Day;
  /**
   * This run's own `ResolvedEndDayScope` (S4-T0c, counts added by S4-T0d) — always resolved to a
   * concrete value by `endDay` itself (`options.scope ?? { kind: 'fullDay' }`, then enriched with
   * `applyCaptureScope`'s own counts for a narrowed run), never left as the `EndDayOptions.scope`
   * input option's own optionality. `cli/` reads this to decide `format-end-day.ts`'s header note,
   * and `core/briefing.ts#generateBriefingMarkdown` receives the SAME value so the terminal report
   * and `summary.md` never disagree about which scope — or which counts — produced them.
   */
  readonly scope: ResolvedEndDayScope;
  readonly discoveredCount: number;
  /** D-022, passed through from `SessionProvider.list()` unchanged. */
  readonly rejectedDiscoveries: readonly RejectedDiscoveryRecord[];
  readonly ineligible: readonly IneligibleSession[];
  readonly captured: readonly CapturedSession[];
  readonly failedCaptures: readonly CaptureFailure[];
  readonly terminationNotices: readonly TerminationNotice[];
  /** Whether `EndDayOptions.dryRun` was set (S2-T5) — `cli/` needs this on the result itself,
   * not just on the options it passed in, to decide how to render `briefingPreview` below. */
  readonly dryRun: boolean;
  /**
   * The day's consolidated briefing markdown, computed but never persisted, when `dryRun: true` —
   * `null` on a real run (the same content is on disk at `~/.seeya/days/<day>/summary.md`
   * instead, no need to carry it in memory too). Built from every handoff already saved today
   * PLUS this run's own freshly-built (unsaved) ones, so a dry-run preview reflects the same
   * consolidated view a real `seeya end-day --session <id>` run later today would produce
   * (`application/briefing.ts#previewDailyBriefing`).
   */
  readonly briefingPreview: string | null;
  /**
   * How many discovered sessions made it through BOTH D-031's scope cut
   * (`core/capture-scope.ts#isCaptureCandidate` — a session with no live registry entry at all
   * never reaches eligibility, see `listedSessions` below) and `EndDayOptions.sessionFilter`, to
   * eligibility/capture. `discoveredCount` stays the TOTAL discovery saw, unaffected by either, so
   * `cli/`'s `--session` handling can tell "0 sessions matched the given id/cwd" (a likely typo)
   * apart from "0 sessions were discovered at all", and so a day with only out-of-scope sessions
   * reads as "0 in scope" rather than silently looking identical to a day with none discovered.
   */
  readonly sessionsInScope: number;
  /**
   * D-031's listing: every discovered session D-031's scope cut excluded from capture — no live
   * registry entry at all (`sessionState: "unknown"`), read as "closed gracefully" rather than
   * "work in progress". **Never mixed into `captured`/`ineligible`/`failedCaptures`** — a listed
   * session was never a capture attempt at all, successful or not, so folding it into any of those
   * buckets would misrepresent what happened to it. Unaffected by `EndDayOptions.sessionFilter`:
   * `--session` narrows what `endDay` tries to CAPTURE, not what it's willing to identify for the
   * reader, so the listing always reflects the full discovery pass.
   */
  readonly listedSessions: readonly SessionListing[];
  /**
   * D-012's cleanup outcome for today's run, or `null` when it didn't run at all — either because
   * `dryRun: true` (deleting a stale fork's file is itself a write a preview must never perform,
   * so it's skipped outright rather than previewed — see docs/QUESTOES.md for why no plan-only
   * path exists for this yet) or because `forkCleanupError` below is set instead.
   */
  readonly forkCleanup: ForkCleanupResult | null;
  /** Set only when `deps.forkCleanup.cleanup()` itself rejected (e.g. `forks.json` became
   * unwritable) — isolated from the rest of the day's result the same way a single session's
   * capture failure is (`failedCaptures`): a janitorial task failing must never make `endDay`
   * itself reject and erase captures that already succeeded. */
  readonly forkCleanupError: string | null;
}
