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
 * <ResumeResult result={response} />
 */
import type { JSX } from 'preact';
import styles from './ResumeResult.module.css';
import { cx } from '../../../components/css-class.js';
import { Surface } from '../../../components/Surface/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { MESSAGES } from '../../../../text/messages.js';
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
 */
function SummarySection(props: {
  readonly heading: string;
  readonly sessions: readonly SummarySession[];
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
              {session.note === undefined
                ? `${session.name} (${session.cwd})`
                : `${session.name} (${session.cwd}) — ${session.note}`}
            </Text>
          </li>
        ))}
      </ul>
    </Stack>
  );
}

export interface ResumeResultProps {
  readonly result: ResumeSummaryResponse;
}

export function ResumeResult(props: ResumeResultProps): JSX.Element {
  const { result } = props;
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
        />
        <SummarySection
          heading={MESSAGES.todaySummarySkippedHeading}
          sessions={result.skipped.map((session) => ({ ...session, note: session.reasonText }))}
        />
        <SummarySection
          heading={MESSAGES.todaySummaryInvalidHeading}
          sessions={result.invalidFallbackAnswers.map((session) => ({
            ...session,
            note: session.reason,
          }))}
        />
        <SummarySection heading={MESSAGES.todaySummaryRemainingHeading} sessions={result.remaining} />
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
