/**
 * V2-T70 (`docs/INTERFACE.md` § 7 item 1): step 1 of the adoption dialog — the session card, the
 * `Existing project`/`New project` choice, and the live explanation of what happens next.
 */
import type { JSX } from 'preact';
import styles from './PickPane.module.css';
import { cx } from '../../../components/css-class.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { Chip } from '../../../components/Chip/index.js';
import { SegmentedControl } from '../../../components/SegmentedControl/index.js';
import { Select } from '../../../components/Select/index.js';
import { TextField } from '../../../components/TextField/index.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import { formatDirectoryPathForDisplay } from '../../../../sidebar/directory-label.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { AdoptionSessionCard } from '../../../../state/adopt-panel.js';
import type { AdoptionControls } from '../useAdoption.js';

export interface PickPaneProps {
  readonly session: AdoptionSessionCard;
  readonly controls: AdoptionControls;
}

function SessionCard(props: {
  readonly session: AdoptionSessionCard;
  readonly homeDir: string;
  readonly platformHint: AdoptionControls['platformHint'];
}): JSX.Element {
  const { session } = props;
  const directory = formatDirectoryPathForDisplay(session.cwd, props.homeDir, props.platformHint);
  return (
    <Stack gap="xs" className={cx(styles, 'sessionCard')}>
      {/* PO review round 2: this row's own three pieces (name, id, state chip) never shrink —
       * on the dialog's own NEW, narrower width (matching every other dialog, item 1/2 of that
       * same review) a longer name no longer fit on one line, and `Dialog.tsx`'s own
       * `overflow-y: auto` computes `overflow-x: auto` too (the CSS spec's mixed-overflow rule),
       * turning that overflow into a stray horizontal scrollbar instead of visibly wrapping.
       * `wrap` is the same backstop `Stack`'s own docstring already offers for exactly this. */}
      <Stack direction="horizontal" gap="sm" align="center" wrap>
        <Text as="span" variant="body-md" weight={500}>
          {session.name}
        </Text>
        <Text as="span" variant="code" tone="tertiary">
          {session.displaySessionId}
        </Text>
        <Chip tone="neutral" size="sm">
          {session.stateLabel}
        </Chip>
      </Stack>
      <Text as="span" variant="code" tone="secondary" truncate title={session.cwd}>
        {directory}
      </Text>
    </Stack>
  );
}

export function PickPane(props: PickPaneProps): JSX.Element {
  const { session, controls } = props;
  const existingOptions = controls.existingProjectOptions;
  return (
    <Stack gap="md" className={cx(styles, 'pane')}>
      <SessionCard
        session={session}
        homeDir={controls.homeDir}
        platformHint={controls.platformHint}
      />
      <SegmentedControl
        ariaLabel={MESSAGES.adoptPickTitle}
        value={controls.mode}
        onChange={(value) => controls.setMode(value as 'existing' | 'new')}
        options={[
          {
            id: 'adoption-pick-existing-option',
            value: 'existing',
            label: MESSAGES.adoptPickExistingLabel,
          },
          { id: 'adoption-pick-new-option', value: 'new', label: MESSAGES.adoptPickNewLabel },
        ]}
      />
      {controls.mode === 'existing' &&
        (existingOptions.length > 0 ? (
          <Select
            id="adoption-pick-existing-select"
            label={MESSAGES.adoptPickExistingLabel}
            value={controls.existingProjectId}
            options={existingOptions}
            onChange={controls.setExistingProjectId}
          />
        ) : (
          <Text as="p" variant="body-sm" tone="tertiary">
            {MESSAGES.adoptPickNoExistingProjects}
          </Text>
        ))}
      {controls.mode === 'new' && (
        <TextField
          id="adoption-pick-new-project-id-input"
          label={MESSAGES.adoptPickNewProjectIdLabel}
          value={controls.newProjectId}
          placeholder="payments-webhooks"
          error={controls.pickError}
          onInput={controls.setNewProjectId}
        />
      )}
      {controls.mode === 'existing' && controls.pickError !== undefined && (
        <Text as="p" variant="body-sm" className={cx(styles, 'error')}>
          {controls.pickError}
        </Text>
      )}
      {controls.explanationLines.length > 0 && (
        <InfoBox>
          <Stack gap="xs">
            <Text as="p" variant="body-sm" weight={500}>
              {MESSAGES.adoptPickExplanationHeading}
            </Text>
            {controls.explanationLines.map((line, index) => (
              <Text
                as="p"
                variant="body-sm"
                key={index}
                className={cx(styles, 'explanationLine')}
                {...(line.fullText !== line.text ? { title: line.fullText } : {})}
              >
                {index + 1}. {line.text}
              </Text>
            ))}
          </Stack>
        </InfoBox>
      )}
    </Stack>
  );
}
