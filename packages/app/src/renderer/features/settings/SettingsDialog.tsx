/**
 * D-052 (V2-T65, `docs/INTERFACE.md` § 8): the Settings dialog — section navigation at the left,
 * the active section's own content, and a footer with the daemon-reread note and `Done`. Replaces
 * `renderer/legacy/settings-dialog-view.ts` entirely (apagado by this task): a real reactive
 * component now, built on `Dialog`'s own `open`/`onClose` (V2-T65's own addition to that shared
 * component) rather than `document.getElementById('settings-dialog').showModal()` by id.
 *
 * Mounted once, inside `<App/>` (`App.tsx`), for the life of the window — `open` only toggles its
 * own `<dialog>`'s visibility; `useSettings`'s own docstring has why the data is never empty on
 * first open.
 *
 * @example
 * <SettingsDialog open={open} onClose={() => setOpen(false)} />
 */
import type { JSX } from 'preact';
import styles from './SettingsDialog.module.css';
import { cx } from '../../components/css-class.js';
import { Dialog } from '../../components/Dialog/index.js';
import { Button } from '../../components/Button/index.js';
import { Text } from '../../components/Text/index.js';
import { MESSAGES } from '../../../text/messages.js';
import { SettingsNav } from './SettingsNav/index.js';
import { GeneralSection } from './GeneralSection/index.js';
import { FieldsSection } from './FieldsSection/index.js';
import { ProjectsSection } from './ProjectsSection/index.js';
import { useSettings } from './useSettings.js';

export interface SettingsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function SettingsDialog(props: SettingsDialogProps): JSX.Element {
  const controls = useSettings(props.open);

  return (
    <Dialog
      id="settings-dialog"
      title={MESSAGES.settingsDialogTitle}
      open={props.open}
      onClose={props.onClose}
      className={cx(styles, 'dialog')}
    >
      <div class={cx(styles, 'body')}>
        <SettingsNav active={controls.activeSection} onSelect={controls.onSelectSection} />
        <div class={cx(styles, 'content')}>
          {controls.activeSection === 'general' && (
            <GeneralSection
              themeRow={controls.themeRow}
              onThemeChange={(value) => controls.onFieldBlur('theme', value)}
              autostart={controls.autostart}
              onAutostartToggle={controls.onAutostartToggle}
              appVersion={controls.appVersion}
            />
          )}
          {controls.activeSection === 'schedule' && (
            <FieldsSection
              title={MESSAGES.settingsSectionLabels.schedule}
              rows={controls.rowsBySection.schedule}
              errorsByKey={controls.errorsByKey}
              onFieldBlur={controls.onFieldBlur}
            />
          )}
          {controls.activeSection === 'capture' && (
            <FieldsSection
              title={MESSAGES.settingsSectionLabels.capture}
              rows={controls.rowsBySection.capture}
              errorsByKey={controls.errorsByKey}
              onFieldBlur={controls.onFieldBlur}
            />
          )}
          {controls.activeSection === 'discovery' && (
            <FieldsSection
              title={MESSAGES.settingsSectionLabels.discovery}
              rows={controls.rowsBySection.discovery}
              errorsByKey={controls.errorsByKey}
              onFieldBlur={controls.onFieldBlur}
            />
          )}
          {controls.activeSection === 'terminal' && (
            <FieldsSection
              title={MESSAGES.settingsSectionLabels.terminal}
              rows={controls.rowsBySection.terminal}
              errorsByKey={controls.errorsByKey}
              onFieldBlur={controls.onFieldBlur}
            />
          )}
          {controls.activeSection === 'projects' && (
            <ProjectsSection lines={controls.projectPolicyLines} />
          )}
        </div>
      </div>
      <div class={cx(styles, 'footer')}>
        <Text as="p" variant="caption" tone="secondary">
          {MESSAGES.settingsDaemonRereadsNote}
        </Text>
        <Button id="settings-dialog-done" variant="secondary" size="sm" onClick={props.onClose}>
          {MESSAGES.settingsDialogDoneButton}
        </Button>
      </div>
    </Dialog>
  );
}
