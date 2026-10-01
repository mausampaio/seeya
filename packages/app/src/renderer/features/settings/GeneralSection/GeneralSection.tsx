/**
 * D-052 (V2-T65, `docs/INTERFACE.md` § 8): the General section — `Theme` (a segmented control,
 * applied live — see `useTheme`'s own sibling mechanism, `main/main.ts`'s own `saveSetting`
 * handler, and `renderer/legacy/theme-view.ts#wireTheme`, which is what actually repaints
 * `data-theme`/the terminal once this control's own save lands), `Start with the system` (the
 * autostart switch, moved here from the sidebar's own footer — `docs/INTERFACE.md`'s own
 * "o botão de autostart sai do rodapé da lateral"), and the installed version at the bottom,
 * selectable for copying.
 *
 * @example
 * <GeneralSection themeRow={themeRow} onThemeChange={onThemeChange} autostart={autostart}
 *   onAutostartToggle={onAutostartToggle} appVersion={appVersion} />
 */
import type { JSX } from 'preact';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { SegmentedControl } from '../../../components/SegmentedControl/index.js';
import { Switch } from '../../../components/Switch/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { SettingsRow } from '../../../../state/settings-fields.js';
import type { AutostartControlState } from '../../../../state/autostart-control-panel.js';

// `rows` always carries a `theme` row by the time Settings is open for real (`useSettings.ts`
// fetches before the dialog ever can) — this is only ever shown in the brief window before that
// first fetch resolves (D-025: the literal word, never an empty label).
const THEME_FALLBACK_LABEL = 'Theme';

const THEME_OPTIONS = [
  {
    value: 'system',
    id: 'settings-theme-option-system',
    label: MESSAGES.settingsThemeOptionSystem,
  },
  { value: 'light', id: 'settings-theme-option-light', label: MESSAGES.settingsThemeOptionLight },
  { value: 'dark', id: 'settings-theme-option-dark', label: MESSAGES.settingsThemeOptionDark },
];

export interface GeneralSectionProps {
  readonly themeRow: SettingsRow | null;
  readonly onThemeChange: (value: string) => void;
  readonly autostart: AutostartControlState;
  readonly onAutostartToggle: (checked: boolean) => void;
  readonly appVersion: string | null;
}

/** `null` means "not applicable right now" (the switch disabled, nothing checked either way,
 * D-025) — `autostart.kind === 'running'` keeps whatever was last known true/false, same
 * "an in-flight action doesn't flip the label back and forth" rule the footer pill already had. */
function autostartChecked(availability: AutostartControlState['availability']): boolean {
  return availability.kind === 'disable';
}

function autostartDisabledReason(state: AutostartControlState): string | undefined {
  if (state.kind === 'running') {
    return undefined;
  }
  const availability = state.availability;
  if (availability.kind === 'notApplicable') {
    return availability.ownerKind === 'cli'
      ? MESSAGES.settingsAutostartNotApplicableCli
      : MESSAGES.settingsAutostartNotApplicableUnknown;
  }
  if (availability.kind === 'unknown') {
    return MESSAGES.settingsAutostartUnknown;
  }
  return undefined;
}

export function GeneralSection(props: GeneralSectionProps): JSX.Element {
  const { autostart } = props;
  const autostartDisabled =
    autostart.kind === 'running' ||
    autostart.availability.kind === 'notApplicable' ||
    autostart.availability.kind === 'unknown';

  return (
    <Stack gap="xl">
      <Text as="h2" variant="heading-4">
        {MESSAGES.settingsSectionLabels.general}
      </Text>

      <Stack gap="xs">
        {/* `themeRow.label` (never `MESSAGES.settingsFieldLabels.theme` directly) — that record is
         * deliberately typed `Record<string, string>` (`text/messages.ts`'s own "no imports on
         * purpose"), so `buildSettingsRows`'s own already-resolved `label` is the type-safe
         * source here, the same string either way. */}
        <Text as="span" variant="body-sm" weight={500} tone="secondary">
          {props.themeRow?.label ?? THEME_FALLBACK_LABEL}
        </Text>
        <SegmentedControl
          ariaLabel={props.themeRow?.label ?? THEME_FALLBACK_LABEL}
          value={props.themeRow?.value ?? 'system'}
          options={THEME_OPTIONS}
          onChange={props.onThemeChange}
        />
        <Text as="p" variant="body-sm" tone="secondary">
          {MESSAGES.settingsThemeDescription}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Switch
          id="settings-autostart-switch"
          label={MESSAGES.settingsAutostartLabel}
          checked={autostartChecked(autostart.availability)}
          disabled={autostartDisabled}
          loading={autostart.kind === 'running'}
          disabledReason={autostartDisabledReason(autostart)}
          onChange={props.onAutostartToggle}
        />
        {!autostartDisabled && (
          <Text as="p" variant="body-sm" tone="secondary">
            {MESSAGES.settingsAutostartDescription}
          </Text>
        )}
        {autostart.kind === 'result' && (
          <Text as="p" variant="caption" tone="secondary">
            {autostart.resultText}
          </Text>
        )}
      </Stack>

      {/* "selecionável para copiar" (docs/INTERFACE.md § 8): plain text, no `user-select: none`
       * anywhere in this app's CSS (confirmed by grep) — nothing extra needed for this to already
       * be selectable/copyable the way any other text on the page is. */}
      {props.appVersion !== null && (
        <Text as="p" variant="caption" tone="tertiary" id="settings-version">
          {MESSAGES.settingsVersionLabel(props.appVersion)}
        </Text>
      )}
    </Stack>
  );
}
