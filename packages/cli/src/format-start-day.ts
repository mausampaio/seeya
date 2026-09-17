/**
 * Plain-text rendering for `seeya start-day` (D-028: CLI output is English; AGENTS.md § "Registro
 * e saída" — user-facing text stays concentrated here, not scattered through
 * `start-day-command.ts`). Same convention `format-end-day.ts`/`format-sessions.ts` already use.
 */
import { describeFallbackReason, formatResumeNotice } from '@seeya-ai/engine/core/resume-notice.js';
import { parseFallbackAnswer } from '@seeya-ai/engine/core/resume-fallback-decision.js';
import type { Handoff, ResumeFallbackReason } from '@seeya-ai/engine/core/types.js';
import type {
  ResumeProgressEvent,
  ResumeSessionsResult,
} from '@seeya-ai/engine/application/start-day.js';

/** Same shape as `format-end-day.ts`/`core/briefing.ts`'s own local helpers — user-facing
 * counts read as English, never as "day(s)". */
function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatNoPendingBriefing(daysSearched: number): string {
  return (
    `No pending briefing found in the last ${pluralize(daysSearched, 'day', 'days')} scanned. ` +
    'Nothing to resume — ' +
    'either nothing has been captured yet ("seeya end-day"), or everything already resumed.'
  );
}

export function formatNoTtyInstructions(): string {
  return (
    'Not running in an interactive terminal, so seeya cannot ask which sessions to resume.\n' +
    'Use "seeya start-day --all" to resume every session above, or ' +
    '"seeya start-day --session <id>" to resume just one.'
  );
}

/**
 * `received` is the `--session` value exactly as this process got it — after whatever the
 * shell already did to it, which this code has no way to undo or even detect on its own
 * (docs/PLANO-DE-ENTREGA.md S3-T5: a maintainer typed a backslash-heavy Windows path in Git
 * Bash, the shell ate the backslashes, and the value that reached `seeya` was silently
 * different from what was typed — with no way for this function, by itself, to tell).
 *
 * **`matchedAgainst` is the seam left for that fix.** S3-T5 owns `start-day-selection.ts` and
 * is adding path normalization there, but it isn't allowed to touch this file (S3-T6 owns it).
 * Once a caller has both the raw value and whatever normalized form it actually compared
 * against handoffs, passing both here shows the reader exactly what was tried — instead of a
 * bare "no match" that hides a mangled value behind a string that still looks plausible. Until
 * a caller has a normalized form to offer, this parameter stays absent (D-025: no fabricated
 * second value), and the message is exactly what it was before.
 */
export function formatNoSessionMatch(received: string, matchedAgainst?: string): string {
  const alsoTried =
    matchedAgainst !== undefined && matchedAgainst !== received
      ? ` (matched against "${matchedAgainst}")`
      : '';
  return `No session in this briefing matches "${received}"${alsoTried} (checked against sessionId and cwd).`;
}

/**
 * Wraps `parseInteractiveSelection`'s `reason` (`start-day-selection.ts`) with the two things it
 * leaves implicit — raised by the maintainer after the first real run. `reason` alone explains
 * only the expected format ("expected a number from 1 to 3, ..."); a reader who just watched a
 * list of sessions scroll by and typed something wrong still doesn't know **what happened as a
 * result**. Confirmed with the maintainer: still no retry loop (S3-T3's "run it again" choice
 * stands) and exit code 0 (same convention as `--session` matching nothing — "did nothing" is
 * one outcome in this command, not a distinct error).
 *
 * The `--help` pointer is here instead of longer syntax help inline: `--all`/`--session` would
 * have let this person skip the picker's question format entirely, and that's a better answer
 * than getting the typed syntax right — but the full explanation of both flags already lives in
 * one place (commander's own `--help`), so it's pointed to rather than duplicated.
 */
export function formatInvalidSelection(reason: string): string {
  return (
    `Invalid answer: ${reason}. Nothing was resumed — run "seeya start-day" again. ` +
    'See "seeya start-day --help" for --all/--session, which skip this question entirely.'
  );
}

export function renderPickerQuestion(candidates: readonly Handoff[]): string {
  const lines = candidates.map(
    (handoff, index) => `  ${index + 1}) ${handoff.name} (${handoff.cwd})`,
  );
  return [
    'Which sessions do you want to resume?',
    ...lines,
    'Enter comma-separated numbers, "all", or leave blank for none: ',
  ].join('\n');
}

export function formatResumeProgress(event: ResumeProgressEvent): string {
  return `Resuming ${event.index} of ${event.total}: ${event.handoff.name} (${event.handoff.cwd})...`;
}

/**
 * S5-T9's "warn BEFORE, and ask" question — the reason text is identical to
 * `core/resume-notice.ts#formatResumeNotice`'s after-the-fact wording (same `describeFallbackReason`
 * helper) because it is the SAME fact, just shown before the fallback runs instead of after.
 *
 * **`resumeFailed` keeps S5-T9's original two answers and default** ("skip" — D-004's fallback
 * loses history, so a distracted Enter must never choose it) — spelled out as `[y/N]`, the capital
 * letter marking the default the same way a shell prompt would.
 *
 * **`promptTooLarge` gets a third answer (V2-T7) and a different default.** "Resume without the
 * plan" keeps the original session's real transcript (the memory that actually matters, spikes
 * K/L) and costs nothing extra — the plan itself stays readable in today's briefing either way —
 * so it's safe for a distracted Enter to choose, unlike "open a fresh session" (which still loses
 * history) or "skip" (which loses the session entirely for today).
 */
export function renderFallbackQuestion(handoff: Handoff, reason: ResumeFallbackReason): string {
  const why = describeFallbackReason(reason);
  const header = `Could not resume session "${handoff.name}" (${handoff.cwd}) as-is — ${why}.\n`;
  if (reason.kind !== 'promptTooLarge') {
    return (
      header +
      'Opening a new session there would start a FRESH conversation: it would not have this ' +
      "session's full history.\n" +
      'Open a new session anyway? [y/N]: '
    );
  }
  return (
    header +
    "Resuming without the plan keeps this session's real history — the plan stays readable in " +
    "today's briefing either way. Opening a fresh session instead would start a FRESH " +
    'conversation with none of that history.\n' +
    'Resume without the plan, open a fresh session instead, or skip? [R/y/n] ' +
    '(blank = resume without the plan): '
  );
}

/** Printed when there is no real terminal to ask the fallback question through — the safe default
 * for THIS `reason` (`parseFallbackAnswer`'s own blank-answer default: "resume without the plan"
 * for `promptTooLarge`, V2-T7; "skip" for `resumeFailed`, unchanged from S5-T9) is applied
 * automatically instead of asking `node:readline` to read a line from a stream that may never send
 * one (`start-day-command.ts`'s own `isTTY` guard). */
export function formatFallbackNoTty(handoff: Handoff, reason: ResumeFallbackReason): string {
  const why = describeFallbackReason(reason);
  const appliedDefault = parseFallbackAnswer('', reason.kind);
  const appliedText =
    appliedDefault.kind === 'resumeWithoutPlan'
      ? "resuming it without yesterday's plan by default"
      : 'skipping it by default';
  return (
    `Could not resume session "${handoff.name}" (${handoff.cwd}) as-is — ${why}. ` +
    'Not running in an interactive terminal, so seeya cannot ask what to do about it — ' +
    `${appliedText} (use "seeya start-day --session <id>" from a real terminal to be asked).`
  );
}

function formatResumedSection(resumed: ResumeSessionsResult['resumed']): string {
  if (resumed.length === 0) {
    return '';
  }
  const lines = ['Resumed:'];
  for (const outcome of resumed) {
    lines.push(`- ${outcome.sessionId} (${outcome.cwd})`);
    const notice = formatResumeNotice(outcome);
    if (notice !== null) {
      lines.push(`    ${notice}`);
    }
  }
  return lines.join('\n');
}

/** Q-027 item 5, applied to reporting: a stopped loop names both what broke AND, in the same
 * section, exactly which sessions never got a chance — never silently folded into "done". */
function formatRemainingSection(result: ResumeSessionsResult): string {
  const header =
    result.stoppedEarly === false
      ? 'Not resumed:'
      : `Not resumed — stopped after "${result.stoppedEarly.handoff.name}" ` +
        `(${result.stoppedEarly.handoff.cwd}) failed: ${result.stoppedEarly.error.message}`;
  const lines = [
    header,
    ...result.remaining.map((handoff) => `- ${handoff.name} (${handoff.cwd})`),
  ];
  return lines.join('\n');
}

/** S5-T9 aceite: "o resumo final continua listando o que aconteceu, inclusive 'pulada a pedido'" —
 * a session the person declined the fallback for is never silently absent from the summary. */
function formatSkippedSection(skipped: ResumeSessionsResult['skipped']): string {
  if (skipped.length === 0) {
    return '';
  }
  const lines = ['Skipped at your request (no new session opened):'];
  for (const { handoff, reason } of skipped) {
    lines.push(`- ${handoff.sessionId} (${handoff.cwd}) — ${describeFallbackReason(reason)}`);
  }
  return lines.join('\n');
}

/** Q-028's "invalid answer aborts that one item, no retry loop" convention, applied to the
 * fallback question instead of the session picker. */
function formatInvalidFallbackAnswersSection(
  invalidFallbackAnswers: ResumeSessionsResult['invalidFallbackAnswers'],
): string {
  if (invalidFallbackAnswers.length === 0) {
    return '';
  }
  const lines = ['Not resumed — invalid answer to the fallback question:'];
  for (const { handoff, reason } of invalidFallbackAnswers) {
    lines.push(`- ${handoff.sessionId} (${handoff.cwd}): ${reason}`);
  }
  return lines.join('\n');
}

export function formatStartDaySummary(result: ResumeSessionsResult): string {
  const sections = [
    formatResumedSection(result.resumed),
    formatSkippedSection(result.skipped),
    formatInvalidFallbackAnswersSection(result.invalidFallbackAnswers),
  ];
  if (result.remaining.length > 0) {
    sections.push(formatRemainingSection(result));
  }
  return sections.filter((section) => section !== '').join('\n\n');
}
