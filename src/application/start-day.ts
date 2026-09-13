/**
 * `seeya start-day`'s steps 4 and 5 (docs/ESPECIFICACAO.md § `seeya start-day`): resume the chosen
 * sessions sequentially — one TTY, one session at a time (docs/spikes/H-retomada-interativa.md,
 * D-015: a process only ever has one terminal to hand over) — and mark each one resumed right
 * after it happens, never before (D-002's "fact, then mark" ordering, applied here to persistence
 * instead of process termination).
 *
 * Which sessions are chosen — the interactive picker, `--all`, `--session <id>` — is decided by
 * `cli/start-day-command.ts`; this module only executes the resume loop for whatever list it's
 * handed, the same separation `application/endDay` already draws between "what's eligible" (its
 * own job) and "how a human is asked" (`cli/`).
 *
 * **S5-T9 adds the fallback question.** Before this task, `SessionResumer.resume()` decided AND
 * opened the fallback in one call — nobody got asked. Now `attemptResume` only ever REPORTS that a
 * fallback would be needed; this module calls `deps.confirmFallback` (I/O lives in `cli/`, the
 * decision it wraps is pure, `core/resume-fallback-decision.ts`) and only calls
 * `SessionResumer.runFallback` when the answer is "open". "Skip" and "invalid answer" are both
 * ordinary, non-throwing outcomes for that one session — the loop continues to the next handoff
 * either way, same as an unmatched `--session` or a blank picker answer already does elsewhere in
 * this command.
 */
import type { FallbackDecision } from '../core/resume-fallback-decision.js';
import { buildResumePrompt } from '../core/resume-prompt.js';
import type { SessionResumer, Storage } from '../core/ports.js';
import type {
  Day,
  Handoff,
  PrimaryResumeAttempt,
  ResumeFallbackReason,
  ResumeOutcome,
} from '../core/types.js';

/**
 * Asks whether to open the fallback session, reason in hand, and returns the parsed decision.
 * I/O (printing the question, reading the answer) lives entirely in `cli/start-day-command.ts`;
 * this module never touches stdin/stdout directly, same separation `StartDayIo` already draws for
 * session selection.
 */
export type FallbackConfirmer = (
  handoff: Handoff,
  reason: ResumeFallbackReason,
) => Promise<FallbackDecision>;

export interface StartDayDeps {
  readonly storage: Storage;
  readonly sessionResumer: SessionResumer;
  readonly confirmFallback: FallbackConfirmer;
}

export interface ResumeSelectionOptions {
  readonly day: Day;
  /** Already chosen by the caller, in the order they should be resumed. */
  readonly handoffs: readonly Handoff[];
}

export interface ResumeProgressEvent {
  readonly index: number;
  readonly total: number;
  readonly handoff: Handoff;
}

/** One handoff whose fallback question was answered "skip" — the original couldn't be resumed
 * as-is, and the person chose not to open a fresh session in its place (S5-T9). Never marked
 * resumed: nothing happened for this session at all, same as a `--session` that matches nothing. */
export interface SkippedFallback {
  readonly handoff: Handoff;
  readonly reason: ResumeFallbackReason;
}

/** One handoff whose fallback question got an answer `core/resume-fallback-decision.ts` couldn't
 * parse (Q-028's "no retry loop" convention, applied here): reported, not resumed, and the loop
 * moves on to the next handoff — a typo answering one question is not the infrastructure failure
 * `StoppedEarly` below exists for. */
export interface InvalidFallbackAnswer {
  readonly handoff: Handoff;
  readonly reason: string;
}

/**
 * Only ever set when the loop stopped early (docs/QUESTOES.md Q-027 item 5, closed for this
 * task): `SessionResumer.runFallback()` throwing means the fallback itself failed fast
 * (`ClaudeSessionResumer`'s own docstring) — the binary or the `cwd` is broken, and retrying the
 * same broken thing for every remaining session would only bury the one error that's actually
 * informative under N repeats of it.
 */
export interface StoppedEarly {
  readonly handoff: Handoff;
  readonly error: Error;
}

export interface ResumeSessionsResult {
  readonly resumed: readonly ResumeOutcome[];
  readonly skipped: readonly SkippedFallback[];
  readonly invalidFallbackAnswers: readonly InvalidFallbackAnswer[];
  /** Every handoff never attempted, in original order — includes the one that just failed when
   * `stoppedEarly` is set (it wasn't resumed either). Empty when the loop ran to completion. */
  readonly remaining: readonly Handoff[];
  readonly stoppedEarly: StoppedEarly | false;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

type AttemptOutcome =
  | { readonly ok: true; readonly kind: 'resumed'; readonly outcome: ResumeOutcome }
  | { readonly ok: true; readonly kind: 'skipped'; readonly reason: ResumeFallbackReason }
  | { readonly ok: true; readonly kind: 'invalidAnswer'; readonly reason: string }
  | { readonly ok: false; readonly error: Error };

/** The fallback half of one session's attempt — only reached once `attemptResume` itself already
 * reported `needsFallback`. Asks first (`deps.confirmFallback`); only "open" ever calls
 * `runFallback`, and only `runFallback` throwing counts as the loop-stopping failure `resumeSessions`
 * reacts to. */
async function attemptFallback(
  deps: StartDayDeps,
  handoff: Handoff,
  prompt: string,
  reason: ResumeFallbackReason,
): Promise<AttemptOutcome> {
  const decision = await deps.confirmFallback(handoff, reason);
  if (decision.kind === 'skip') {
    return { ok: true, kind: 'skipped', reason };
  }
  if (decision.kind === 'invalid') {
    return { ok: true, kind: 'invalidAnswer', reason: decision.reason };
  }
  try {
    const outcome = await deps.sessionResumer.runFallback(
      handoff.sessionId,
      handoff.cwd,
      prompt,
      reason,
    );
    return { ok: true, kind: 'resumed', outcome };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
}

/**
 * One session's attempt: try the original session; if a fallback would be needed, ask before ever
 * opening one (S5-T9). Marks the session resumed in storage immediately after a `resumed` outcome
 * — fallback included, same as before this task (a fallback the person chose still means they got
 * a session to work in) — but a `skipped`/`invalidAnswer` outcome is never marked: nothing actually
 * happened for that session. `resumedSoFar` is mutated in place so the caller's loop can keep
 * passing the same growing set forward without re-reading it from `deps.storage` on every
 * iteration.
 */
async function attemptResume(
  deps: StartDayDeps,
  resumedSoFar: Set<string>,
  day: Day,
  handoff: Handoff,
): Promise<AttemptOutcome> {
  const prompt = buildResumePrompt(handoff);
  let primary: PrimaryResumeAttempt;
  try {
    primary = await deps.sessionResumer.attemptResume(handoff.sessionId, handoff.cwd, prompt);
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
  const attempted: AttemptOutcome =
    primary.kind === 'resumed'
      ? { ok: true, kind: 'resumed', outcome: primary.outcome }
      : await attemptFallback(deps, handoff, prompt, primary.reason);

  if (attempted.ok && attempted.kind === 'resumed') {
    resumedSoFar.add(handoff.sessionId);
    await deps.storage.saveResumedSessionIds(day, resumedSoFar);
  }
  return attempted;
}

/**
 * @example
 * const result = await resumeSessions(deps, { day: '2026-08-16', handoffs: chosen }, (event) =>
 *   console.log(`Resuming ${event.index} of ${event.total}: ${event.handoff.name}`),
 * );
 * // result.stoppedEarly === false means every handoff in `chosen` was attempted.
 */
export async function resumeSessions(
  deps: StartDayDeps,
  options: ResumeSelectionOptions,
  onProgress?: (event: ResumeProgressEvent) => void,
): Promise<ResumeSessionsResult> {
  const resumedSoFar = new Set(await deps.storage.readResumedSessionIds(options.day));
  const resumed: ResumeOutcome[] = [];
  const skipped: SkippedFallback[] = [];
  const invalidFallbackAnswers: InvalidFallbackAnswer[] = [];
  for (const [index, handoff] of options.handoffs.entries()) {
    onProgress?.({ index: index + 1, total: options.handoffs.length, handoff });
    const attempted = await attemptResume(deps, resumedSoFar, options.day, handoff);
    if (!attempted.ok) {
      return {
        resumed,
        skipped,
        invalidFallbackAnswers,
        remaining: options.handoffs.slice(index),
        stoppedEarly: { handoff, error: attempted.error },
      };
    }
    if (attempted.kind === 'resumed') {
      resumed.push(attempted.outcome);
    } else if (attempted.kind === 'skipped') {
      skipped.push({ handoff, reason: attempted.reason });
    } else {
      invalidFallbackAnswers.push({ handoff, reason: attempted.reason });
    }
  }
  return { resumed, skipped, invalidFallbackAnswers, remaining: [], stoppedEarly: false };
}
