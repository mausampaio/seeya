/**
 * "Adopted sessions" (V2-T83, `docs/INTERFACE.md` § 4a): one row per `AdoptionRecord` of this
 * project — the copy's short id, the original's short id, and when it was adopted — each with
 * `Revert…`, which opens the § 9 confirmation (the engine asks it, once it knows how many commits
 * it would revert). Renders nothing when the project has no adoption: the section is hidden, not
 * shown empty ("seção escondida quando o projeto não tem adoção").
 */
import type { JSX } from 'preact';
import styles from './AdoptionsSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { ProjectDetailsAdoptionRow } from '../../../../state/project-details.js';
import type { PendingProjectAction } from '../useProjectDetails.js';

export interface AdoptionsSectionProps {
  readonly adoptions: readonly ProjectDetailsAdoptionRow[];
  readonly writeBlockedReason: string | undefined;
  readonly pending: PendingProjectAction | null;
  readonly onRevert: (forkSessionId: string) => void;
}

export function AdoptionsSection(props: AdoptionsSectionProps): JSX.Element | null {
  if (props.adoptions.length === 0) {
    return null;
  }
  return (
    <Section
      id="project-details-adoptions"
      title={MESSAGES.projectDetailsAdoptionsHeading}
      className={cx(styles, 'section')}
    >
      <ul class={cx(styles, 'list')}>
        {props.adoptions.map((adoption) => {
          const reverting =
            props.pending?.kind === 'revertAdoption' &&
            props.pending.forkSessionId === adoption.forkSessionId;
          return (
            <li
              key={adoption.forkSessionId}
              class={cx(styles, 'item')}
              data-fork-session-id={adoption.forkSessionId}
            >
              <div class={cx(styles, 'text')}>
                <Text as="span" variant="body-sm" weight={500} title={adoption.forkSessionId}>
                  {MESSAGES.projectDetailsAdoptionCopy}{' '}
                  <span class={cx(styles, 'mono')}>{adoption.forkDisplayId}</span>
                </Text>
                <Text
                  as="span"
                  variant="caption"
                  tone="secondary"
                  title={adoption.originalSessionId}
                >
                  {MESSAGES.projectDetailsAdoptionOriginal} {adoption.originalDisplayId} ·{' '}
                  {MESSAGES.projectDetailsAdoptionAdoptedOn(adoption.adoptedAt.toLocaleString())}
                </Text>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={reverting}
                disabled={props.writeBlockedReason !== undefined || props.pending !== null}
                title={
                  props.writeBlockedReason ??
                  MESSAGES.projectDetailsRevertLabel(adoption.forkDisplayId)
                }
                onClick={() => props.onRevert(adoption.forkSessionId)}
              >
                {MESSAGES.projectDetailsRevert}
              </Button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
