/**
 * V2-T67 (`docs/INTERFACE.md` § 4): "Título `Projects`, total, e `New project` (primário)."
 *
 * @example
 * <ProjectsHeader count={3} onNewProject={openNewProjectDialog} />
 */
import type { JSX } from 'preact';
import styles from './ProjectsHeader.module.css';
import { cx } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';

export interface ProjectsHeaderProps {
  readonly count: number;
  readonly onNewProject: () => void;
}

export function ProjectsHeader(props: ProjectsHeaderProps): JSX.Element {
  return (
    <div class={cx(styles, 'header')}>
      <div class={cx(styles, 'titleGroup')}>
        <Text as="h1" variant="heading-3">
          {MESSAGES.projectsTabTitle}
        </Text>
        <Text as="span" variant="body-sm" tone="secondary">
          {MESSAGES.projectsTabCount(props.count)}
        </Text>
      </div>
      {/* No `id="new-project-button"` here on purpose — the sidebar's own `+`
       * (`FavoritesSection.tsx`) already carries that exact id, the one
       * `main/main.ts#verifyTextFieldClipboardRoundTrip` (V2-T74) drives; a SECOND element with
       * the same id would make `document.getElementById` ambiguous (invalid HTML). Both buttons
       * open the identical dialog through the same `openNewProjectDialog()` bridge. */}
      <Button onClick={props.onNewProject}>{MESSAGES.newProjectButton}</Button>
    </div>
  );
}
