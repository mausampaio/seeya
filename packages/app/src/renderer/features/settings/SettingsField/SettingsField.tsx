/**
 * D-052 (V2-T65, `docs/INTERFACE.md` § 8): one generic field row — a `TextField` with the key's
 * own mono hint, the custom/default `Chip`, and a description underneath. Saves on blur; a
 * rejected value leaves whatever the person typed in place (`TextField`'s own controlled `value`
 * only ever reflects the LAST SAVED row, never overwritten mid-edit by this component) with the
 * refusal shown on the very next line (AGENTS.md § "Mensagens de erro" — the raw value and the
 * expected shape, `parseConfigFieldUpdate`'s own message, never reworded here).
 *
 * @example
 * <SettingsField row={row} error={errorsByKey[row.key]} onBlur={onFieldBlur} />
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { TextField } from '../../../components/TextField/index.js';
import { Chip } from '../../../components/Chip/index.js';
import { Text } from '../../../components/Text/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { EditableConfigKey, SettingsRow } from '../../../../state/settings-fields.js';

export interface SettingsFieldProps {
  readonly row: SettingsRow;
  readonly error?: string | undefined;
  readonly onBlur: (key: EditableConfigKey, rawValue: string) => void;
}

export function SettingsField(props: SettingsFieldProps): JSX.Element {
  const { row } = props;
  // A local draft, not the row's own value directly: `TextField` is controlled, and re-rendering
  // every OTHER field's row on a successful save (`useSettings.ts`'s own `onFieldBlur`) must never
  // overwrite what someone is still mid-typing in THIS one before they've blurred it.
  const [draft, setDraft] = useState(row.value);
  useEffect(() => {
    // The row's own value changed from OUTSIDE this field (another save, a fresh open) — resync
    // the draft, UNLESS this exact field is focused (someone mid-typing in it right now; their
    // keystrokes own the draft until they blur).
    if (document.activeElement?.id !== row.key) {
      setDraft(row.value);
    }
  }, [row.value, row.key]);
  return (
    <Stack gap="xs">
      <TextField
        id={row.key}
        label={row.label}
        value={draft}
        hint={row.key}
        error={props.error}
        onInput={setDraft}
        onBlur={(value) => props.onBlur(row.key, value)}
        trailing={
          <Chip tone={row.origin === 'chosen' ? 'brand' : 'neutral'} variant="outline" size="sm">
            {row.origin === 'chosen'
              ? MESSAGES.settingsOriginChosen
              : MESSAGES.settingsOriginDefault}
          </Chip>
        }
      />
      <Text as="p" variant="body-sm" tone="secondary">
        {row.description}
      </Text>
    </Stack>
  );
}
