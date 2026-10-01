/**
 * D-052 (V2-T65): the generic section body — Schedule/Capture/Discovery/Terminal are all "a
 * heading plus one `SettingsField` per row", so they share this one component instead of four
 * near-identical ones.
 *
 * @example
 * <FieldsSection title="Schedule" rows={rowsBySection.schedule} errorsByKey={errorsByKey} onFieldBlur={onFieldBlur} />
 */
import type { JSX } from 'preact';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { SettingsField } from '../SettingsField/index.js';
import type { EditableConfigKey, SettingsRow } from '../../../../state/settings-fields.js';

export interface FieldsSectionProps {
  readonly title: string;
  readonly rows: readonly SettingsRow[];
  readonly errorsByKey: Readonly<Record<string, string>>;
  readonly onFieldBlur: (key: EditableConfigKey, rawValue: string) => void;
}

export function FieldsSection(props: FieldsSectionProps): JSX.Element {
  return (
    <Stack gap="lg">
      <Text as="h2" variant="heading-4">
        {props.title}
      </Text>
      <Stack gap="lg">
        {props.rows.map((row) => (
          <SettingsField
            key={row.key}
            row={row}
            error={props.errorsByKey[row.key]}
            onBlur={props.onFieldBlur}
          />
        ))}
      </Stack>
    </Stack>
  );
}
