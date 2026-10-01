/**
 * D-052 (V2-T65, `docs/INTERFACE.md` § 8): "Projects — a política por projeto, só leitura, como
 * hoje." One line per `ProjectPolicyLine` (`state/settings-panel.ts#buildProjectPolicyLines`),
 * unchanged content from the legacy dialog — editing stays the CLI's job (`seeya config policy
 * <cwd>`), this section only shows what's already decided.
 *
 * @example
 * <ProjectsSection lines={projectPolicyLines} />
 */
import type { JSX } from 'preact';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { ProjectPolicyLine } from '../../../../state/settings-fields.js';

export interface ProjectsSectionProps {
  readonly lines: readonly ProjectPolicyLine[];
}

export function ProjectsSection(props: ProjectsSectionProps): JSX.Element {
  return (
    <Stack gap="lg">
      <Text as="h2" variant="heading-4">
        {MESSAGES.settingsSectionLabels.projects}
      </Text>
      <Text as="p" variant="body-sm" tone="secondary">
        {MESSAGES.settingsProjectPolicyHeading}
      </Text>
      {props.lines.length === 0 ? (
        <Text as="p" variant="body-sm" tone="secondary">
          {MESSAGES.settingsProjectPolicyEmpty}
        </Text>
      ) : (
        <Stack gap="xs">
          {props.lines.map((line) => (
            <Text key={line.cwd} as="p" variant="code" tone="secondary">
              {MESSAGES.settingsProjectPolicyLine(line)}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
