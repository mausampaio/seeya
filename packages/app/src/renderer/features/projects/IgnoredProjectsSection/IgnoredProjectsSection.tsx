/**
 * V2-T67 (`docs/INTERFACE.md` § 4, V2-T72 item 2): "**Ignored projects**: seção própria, abaixo da
 * tabela, só visível quando há pelo menos uma entrada — um `seeya.json` que não valida, id
 * (derivado do nome do diretório) e o motivo, a mesma informação da lateral (seção 1) ... Sem ação
 * de linha nesta tarefa." Reuses `MESSAGES.ignoredProjectsHeading`/`ignoredProjectRowLabel` — the
 * exact same text the lateral (`renderer/features/sidebar/NavList/`) and `seeya project list`'s
 * own "Ignored entries" already show, never a second redaction of the same fact.
 *
 * PO review round 1: the raw `reason` used to be a `zod`/`JSON.parse` message with a full absolute
 * path baked in, long enough to wrap the row across several lines — `row.reason` is already the
 * short, `~`-abbreviated line by the time it reaches here
 * (`state/projects-panel.ts#toIgnoredProjectRow`, `state/error-reason-summary.ts`), and `Text`'s
 * own `truncate` prop (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`) is the
 * second, CSS-level backstop for whatever abbreviation alone doesn't shorten enough at a narrow
 * window width. The untouched `row.fullReason` is one hover away via `title`, never hidden
 * outright — only attached when it actually differs from the visible line (the same
 * `text !== fullText` convention `ResultPane.tsx#toReasonItem` already uses for End day).
 *
 * Renders nothing at all when `rows` is empty — this section is noise in the ordinary case
 * (`IgnoredProjectPanelRow`'s own docstring).
 *
 * @example
 * <IgnoredProjectsSection rows={panel.ignoredProjects} />
 */
import type { JSX } from 'preact';
import styles from './IgnoredProjectsSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { Text } from '../../../components/Text/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { IgnoredProjectPanelRow } from '../../../../state/projects-panel.js';

export interface IgnoredProjectsSectionProps {
  readonly rows: readonly IgnoredProjectPanelRow[];
}

export function IgnoredProjectsSection(props: IgnoredProjectsSectionProps): JSX.Element | null {
  if (props.rows.length === 0) {
    return null;
  }
  return (
    <Section
      id="projects-tab-ignored-projects"
      title={MESSAGES.ignoredProjectsHeading}
      className={cx(styles, 'section')}
    >
      <ul class={cx(styles, 'list')}>
        {props.rows.map((row) => {
          const label = MESSAGES.ignoredProjectRowLabel(row.projectId, row.reason);
          const fullLabel = MESSAGES.ignoredProjectRowLabel(row.projectId, row.fullReason);
          return (
            <li key={row.projectId} class={cx(styles, 'item')}>
              <Text
                as="span"
                variant="body-sm"
                tone="secondary"
                truncate
                title={label !== fullLabel ? fullLabel : undefined}
              >
                {label}
              </Text>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
