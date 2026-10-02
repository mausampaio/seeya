/**
 * V2-T77 (`docs/INTERFACE.md` § 5a): the sessions a project's row expands to — its most recent ones
 * (`state/project-sessions-preview.ts`, at most five), each with the action its PROCESS state allows
 * (`state/sessions-table.ts#resolveSessionProcessAction`, the same rule the Sessions tab applies):
 * `Go to tab` for the one open in this window, `Resume` for one with no process, nothing for one
 * running somewhere else (a second copy would be opened, Q-106).
 *
 * Every session a project's `open` starts has the SAME name (the project directory's), so the short
 * id (mono) and the last activity are what tell the rows apart — this panel invents no summary.
 * `Resume` goes through the project's own `open` flow (lock, hooks, `CLAUDE.md`, the same
 * questions), never the simple resume. Rendered as one full-width cell of the table
 * (`ProjectsTable.tsx`), under the project's own row.
 */
import type { JSX } from 'preact';
import styles from './ProjectSessionsPanel.module.css';
import { cx } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import {
  formatSessionLastActivityText,
  type ProjectPanelRow,
  type ProjectPanelSessionRow,
} from '../../../../state/projects-panel.js';
import { buildProjectSessionsPreview } from '../../../../state/project-sessions-preview.js';
import { resolveSessionProcessAction } from '../../../../state/sessions-table.js';

export interface ProjectSessionsPanelProps {
  readonly project: ProjectPanelRow;
  readonly isResumePending: (sessionId: string) => boolean;
  readonly onResume: (projectId: string, sessionId: string) => void;
  readonly onGoToTab: (tabId: string) => void;
  readonly onShowAll: (projectId: string) => void;
}

function SessionAction(props: {
  readonly session: ProjectPanelSessionRow;
  readonly projectId: string;
  readonly pending: boolean;
  readonly onResume: ProjectSessionsPanelProps['onResume'];
  readonly onGoToTab: ProjectSessionsPanelProps['onGoToTab'];
}): JSX.Element {
  const action = resolveSessionProcessAction(props.session);
  if (action.kind === 'goToTab') {
    return (
      <Button
        size="sm"
        className={cx(styles, 'actionButton')}
        onClick={() => props.onGoToTab(action.tabId)}
      >
        {MESSAGES.projectsActionGoToTab}
      </Button>
    );
  }
  if (action.kind === 'runningElsewhere') {
    return <span />;
  }
  return (
    // The marker lives on a wrapper: `Button` has no `data-*` passthrough (same reasoning
    // `SessionsTable.tsx`'s own `data-adopt-session-id` wrapper documents), and the verification
    // instrumentation needs to click a SPECIFIC session's own Resume.
    <span data-resume-session-id={props.session.sessionId}>
      <Button
        size="sm"
        variant="secondary"
        loading={props.pending}
        className={cx(styles, 'actionButton')}
        title={MESSAGES.projectSessionsResumeTitle}
        onClick={() => props.onResume(props.projectId, props.session.sessionId)}
      >
        {MESSAGES.sessionsActionResume}
      </Button>
    </span>
  );
}

function SessionRow(props: {
  readonly session: ProjectPanelSessionRow;
  readonly projectId: string;
  readonly panel: ProjectSessionsPanelProps;
}): JSX.Element {
  const { session } = props;
  const lastActivity =
    session.lastActivity === null
      ? MESSAGES.sessionLastActivityUnknown
      : formatSessionLastActivityText(session.lastActivity);
  return (
    <li class={cx(styles, 'sessionRow')}>
      <Text as="span" variant="body-sm" truncate title={session.name}>
        {session.name}
      </Text>
      <Text as="span" variant="code" tone="secondary" truncate title={session.sessionId}>
        {session.displaySessionId}
      </Text>
      <Text as="span" variant="body-sm" tone="secondary" truncate title={session.stateLabel}>
        {session.stateLabel}
      </Text>
      <Text as="span" variant="body-sm" tone="secondary" truncate title={lastActivity}>
        {lastActivity}
      </Text>
      <div class={cx(styles, 'actionCell')}>
        <SessionAction
          session={session}
          projectId={props.projectId}
          pending={props.panel.isResumePending(session.sessionId)}
          onResume={props.panel.onResume}
          onGoToTab={props.panel.onGoToTab}
        />
      </div>
    </li>
  );
}

export function ProjectSessionsPanel(props: ProjectSessionsPanelProps): JSX.Element {
  const { project } = props;
  const preview = buildProjectSessionsPreview(project.sessions);
  if (preview.totalCount === 0) {
    return (
      <Text as="p" variant="body-sm" tone="secondary" className={cx(styles, 'empty')}>
        {MESSAGES.projectSessionsNone}
      </Text>
    );
  }
  return (
    <div class={cx(styles, 'panel')}>
      <ul class={cx(styles, 'list')} aria-label={MESSAGES.projectSessionsListLabel(project.name)}>
        {preview.rows.map((session) => (
          <SessionRow
            key={session.sessionId}
            session={session}
            projectId={project.projectId}
            panel={props}
          />
        ))}
      </ul>
      <Button size="sm" variant="ghost" onClick={() => props.onShowAll(project.projectId)}>
        {MESSAGES.projectSessionsShowAll(preview.totalCount)}
      </Button>
    </div>
  );
}
