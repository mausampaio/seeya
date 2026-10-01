/**
 * D-052 (V2-T65, `docs/INTERFACE.md` § 8): the Settings dialog's own data and actions — section
 * navigation, the generic field rows (`state/settings-panel.ts#buildSettingsRows`), per-field save
 * errors, the theme control, the autostart switch, and the installed version. One hook, like every
 * other feature region (`useSidebar.ts`/`useSidebarFooter.ts`).
 *
 * **Never opens empty (PO review precedent, V2-T75 round 3 — "a lateral ficava vazia... a
 * primeira pintura descartava o invoke").** `SettingsDialog` is mounted once, inside `<App/>`,
 * for the life of the window — `open` only ever toggles the native `<dialog>`'s own visibility
 * (`Dialog.tsx`'s own `open`/`onClose`). This hook fetches `getSettingsPanel`/
 * `getAutostartAvailability`/`getAppVersion` on MOUNT, well before anyone could click the button
 * that opens it, and fetches `getSettingsPanel` again every time `open` turns `true` (another
 * process — `seeya config set`, or this dialog's own previous save — may have written
 * `config.json` since the window started; the legacy dialog already had this "always fresh on
 * open" rule, D-052 keeps it).
 *
 * **Imports `settings-fields.js`, never `settings-panel.js` (production defect, found by a real
 * launch).** `settings-panel.ts` imports `@seeya-ai/engine/adapters/storage/config-schema.js`
 * VALUES at its own top level — safe in `main/main.ts`'s Node context, but that module reads
 * `process.platform` at ITS top level too, and the whole chain crashed the renderer bundle
 * (`Uncaught ReferenceError: process is not defined`) the moment this hook imported a value from
 * it. `settings-fields.ts`'s own docstring has the full story.
 */
import { useCallback, useEffect, useReducer, useState } from 'preact/hooks';
import { getSeeyaApi } from '../../ipc/client.js';
import {
  findSettingsRow,
  groupSettingsRowsBySection,
  type EditableConfigKey,
  type ProjectPolicyLine,
  type SettingsRow,
  type SettingsSection,
} from '../../../state/settings-fields.js';
import {
  reduceAutostartControl,
  type AutostartControlState,
} from '../../../state/autostart-control-panel.js';

export type SettingsNavSection = SettingsSection | 'projects';

const EMPTY_ROWS: readonly SettingsRow[] = [];
const EMPTY_POLICY_LINES: readonly ProjectPolicyLine[] = [];

const INITIAL_AUTOSTART_STATE: AutostartControlState = {
  kind: 'idle',
  availability: { kind: 'unknown' },
};

export interface SettingsControls {
  readonly activeSection: SettingsNavSection;
  readonly onSelectSection: (section: SettingsNavSection) => void;
  readonly rows: readonly SettingsRow[];
  readonly rowsBySection: Record<SettingsSection, readonly SettingsRow[]>;
  readonly projectPolicyLines: readonly ProjectPolicyLine[];
  readonly errorsByKey: Readonly<Record<string, string>>;
  readonly onFieldBlur: (key: EditableConfigKey, rawValue: string) => void;
  readonly themeRow: SettingsRow | null;
  readonly autostart: AutostartControlState;
  readonly onAutostartToggle: (checked: boolean) => void;
  readonly appVersion: string | null;
}

export function useSettings(open: boolean): SettingsControls {
  const api = getSeeyaApi();
  const [activeSection, setActiveSection] = useState<SettingsNavSection>('general');
  const [rows, setRows] = useState<readonly SettingsRow[]>(EMPTY_ROWS);
  const [projectPolicyLines, setProjectPolicyLines] =
    useState<readonly ProjectPolicyLine[]>(EMPTY_POLICY_LINES);
  const [errorsByKey, setErrorsByKey] = useState<Readonly<Record<string, string>>>({});
  const [autostart, dispatchAutostart] = useReducer(
    reduceAutostartControl,
    INITIAL_AUTOSTART_STATE,
  );
  const [appVersion, setAppVersion] = useState<string | null>(null);

  const fetchPanel = useCallback(() => {
    void api.getSettingsPanel().then((response) => {
      setRows(response.rows);
      setProjectPolicyLines(response.projectPolicyLines);
    });
  }, [api]);

  // Warms up BEFORE the dialog can ever open (mount-time) — see this module's own docstring.
  useEffect(() => {
    fetchPanel();
    void api.getAutostartAvailability().then((availability) => {
      dispatchAutostart({ kind: 'availabilityUpdated', availability });
    });
    void api.getAppVersion().then(setAppVersion);
    return api.onAutostartAvailabilityUpdate((availability) => {
      dispatchAutostart({ kind: 'availabilityUpdated', availability });
    });
  }, [api, fetchPanel]);

  // Refreshed every time the dialog opens — "always fresh", see this module's own docstring.
  useEffect(() => {
    if (open) {
      fetchPanel();
    }
  }, [open, fetchPanel]);

  const onFieldBlur = useCallback(
    (key: EditableConfigKey, rawValue: string) => {
      void api.saveSetting({ key, rawValue }).then((response) => {
        if (!response.ok) {
          setErrorsByKey((current) => ({ ...current, [key]: response.error }));
          return;
        }
        setRows(response.rows);
        setErrorsByKey((current) =>
          key in current
            ? Object.fromEntries(Object.entries(current).filter(([entryKey]) => entryKey !== key))
            : current,
        );
      });
    },
    [api],
  );

  const onAutostartToggle = useCallback(
    (checked: boolean) => {
      if (
        (autostart.kind !== 'idle' && autostart.kind !== 'result') ||
        autostart.availability.kind === 'notApplicable' ||
        autostart.availability.kind === 'unknown'
      ) {
        return;
      }
      const action = checked ? 'enable' : 'disable';
      dispatchAutostart({ kind: 'clicked' });
      void api.autostartControl({ action }).then((response) => {
        dispatchAutostart({
          kind: 'finished',
          resultText: response.resultText,
          availability: response.availability,
        });
      });
    },
    [api, autostart],
  );

  return {
    activeSection,
    onSelectSection: setActiveSection,
    rows,
    rowsBySection: groupSettingsRowsBySection(rows),
    projectPolicyLines,
    errorsByKey,
    onFieldBlur,
    themeRow: rows.length === 0 ? null : findSettingsRow(rows, 'theme'),
    autostart,
    onAutostartToggle,
    appVersion,
  };
}
