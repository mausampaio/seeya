/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): "...resultado por seção (Resumed, Skipped, Not
 * resumed…) aparecem na própria aba, acima dos cartões." Replaces `renderer/legacy/
 * today-panel-view.ts#renderResumeSummary`/`renderSummarySection`/`resumeOutcomeNote` (apagados by
 * this task) — same four sections `cli/format-start-day.ts#formatStartDaySummary` shows, built
 * from the same `ResumeSummaryResponse` (`state/resume-summary.ts`'s own output), never a second
 * phrasing of the same facts (Q-073).
 *
 * `null` renders nothing — `Today.tsx` only mounts this once `useToday`'s own `result` is set.
 *
 * @example
 * <ResumeResult result={response} homeDir={homeDir} platformHint={platformHint} />
 */
import type { JSX } from 'preact';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import styles from './ResumeResult.module.css';
import { cx } from '../../../components/css-class.js';
import { Surface } from '../../../components/Surface/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { formatDirectoryPathForDisplay } from '../../../../sidebar/directory-label.js';
import type { ResumeSummaryOutcome, ResumeSummaryResponse } from '../../../../ipc/channels.js';

/** V2-T7: the resumed section's own note per `ResumeOutcome`'s three forms — same text
 * `renderer/legacy/today-panel-view.ts#resumeOutcomeNote` used to compute. */
function resumeOutcomeNote(outcome: ResumeSummaryOutcome): string | undefined {
  if (outcome.kind === 'resumed') {
    return undefined;
  }
  return outcome.kind === 'resumedWithoutPlan'
    ? MESSAGES.todaySummaryResumedWithoutPlanNote(outcome.noteText)
    : MESSAGES.todaySummaryFallbackNote(outcome.noteText);
}

interface SummarySession {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
  readonly note?: string | undefined;
}

/** One labeled list of `name (cwd)` lines, `null` when `sessions` is empty — an empty section
 * never renders as a bare heading with nothing under it (same as the legacy function it replaces).
 *
 * PO review of V2-T66, third round, item 2: `cwd` used to go straight into the line's own string
 * interpolation — the one raw, absolute `cwd` left in the Today tab once the card/notice/selector
 * were fixed (this is what "Resumed" showed in `today-resume-result-sync-dark.png`). Each `cwd`
 * now goes through the SAME `formatDirectoryPathForDisplay` those three already use, in a `<span>`
 * of its own so the full raw path still has somewhere to live (its own `title`) without `title`-ing
 * the whole line (which would also cover `name`/`note`).
 */
function SummarySection(props: {
  readonly heading: string;
  readonly sessions: readonly SummarySession[];
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}): JSX.Element | null {
  if (props.sessions.length === 0) {
    return null;
  }
  return (
    <Stack gap="xs">
      <Text as="p" variant="body-sm" weight={600}>
        {props.heading}
      </Text>
      <ul class={cx(styles, 'list')}>
        {props.sessions.map((session) => (
          <li key={session.sessionId}>
            <Text as="span" variant="body-sm">
              {session.name} (
              <span title={session.cwd}>
                {formatDirectoryPathForDisplay(session.cwd, props.homeDir, props.platformHint)}
              </span>
              ){session.note === undefined ? '' : ` — ${session.note}`}
            </Text>
          </li>
        ))}
      </ul>
    </Stack>
  );
}

export interface ResumeResultProps {
  readonly result: ResumeSummaryResponse;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}

export function ResumeResult(props: ResumeResultProps): JSX.Element {
  const { result, homeDir, platformHint } = props;
  return (
    <Surface padding="md" className={cx(styles, 'result')}>
      <Stack gap="md">
        <SummarySection
          heading={MESSAGES.todaySummaryResumedHeading}
          sessions={result.resumed.map((outcome) => ({
            sessionId: outcome.sessionId,
            name: outcome.name,
            cwd: outcome.cwd,
            note: resumeOutcomeNote(outcome),
          }))}
          homeDir={homeDir}
          platformHint={platformHint}
        />
        <SummarySection
          heading={MESSAGES.todaySummarySkippedHeading}
          sessions={result.skipped.map((session) => ({ ...session, note: session.reasonText }))}
          homeDir={homeDir}
          platformHint={platformHint}
        />
        <SummarySection
          heading={MESSAGES.todaySummaryInvalidHeading}
          sessions={result.invalidFallbackAnswers.map((session) => ({
            ...session,
            note: session.reason,
          }))}
          homeDir={homeDir}
          platformHint={platformHint}
        />
        <SummarySection
          heading={MESSAGES.todaySummaryRemainingHeading}
          sessions={result.remaining}
          homeDir={homeDir}
          platformHint={platformHint}
        />
        {result.stoppedEarly !== false && (
          <Text as="p" variant="body-sm" tone="secondary">
            {MESSAGES.todaySummaryStoppedEarly(
              result.stoppedEarly.session.name,
              result.stoppedEarly.message,
            )}
          </Text>
        )}
      </Stack>
    </Surface>
  );
}
