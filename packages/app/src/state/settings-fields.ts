/**
 * V2-T65 production defect, found by a real verification launch (never by a unit test — happy-dom
 * doesn't execute a bundled renderer the way Electron's own Chromium does): `state/settings-panel.ts`
 * imports `DEFAULT_CONFIG`/`EDITABLE_CONFIG_KEYS`/`formatConfigValue` from
 * `@seeya-ai/engine/adapters/storage/config-schema.js` AT RUNTIME (not just as types) — fine for
 * `main/main.ts` (a Node context, where `process` exists), but `adapters/` is not a pure module
 * (D-020: only `core/`/`application/` are) — `config-schema.ts` itself reads `process.platform` at
 * its own TOP LEVEL. The moment ANY renderer file imports a VALUE from `settings-panel.ts` (this
 * task's own `useSettings.ts`, for `groupSettingsRowsBySection`/`findSettingsRow`), esbuild bundles
 * `settings-panel.ts`'s entire module graph into the browser bundle — ES modules run their whole
 * top level on import regardless of which named export a caller actually uses — and the renderer
 * crashed on load with `Uncaught ReferenceError: process is not defined`, taking the ENTIRE
 * `<AppShell/>` tree down with it (confirmed with a real built-and-launched Electron window;
 * `renderer/features/settings/SettingsDialog.test.tsx`'s own happy-dom tests never caught this —
 * they mock `window.seeya`, not the actual bundling).
 *
 * This module holds exactly the pieces the RENDERER needs that do NOT require that runtime import:
 * the `SettingsRow`/`ProjectPolicyLine`/`SettingsSection` shapes (`EditableConfigKey` only as a
 * TYPE — erased by esbuild, never a runtime import) and the two pure functions over an
 * already-built `SettingsRow[]`. `settings-panel.ts` re-exports everything here, unchanged for its
 * existing callers (`main/main.ts`, `ipc/channels.ts`), and keeps `buildSettingsRows`/
 * `buildProjectPolicyLines` — the two functions that genuinely need the engine import — to itself,
 * never imported by renderer code.
 */
import type { EditableConfigKey } from '@seeya-ai/engine/adapters/storage/config-schema.js';

export type { EditableConfigKey };

export type SettingsValueOrigin = 'default' | 'chosen';

/**
 * V2-T65 (docs/INTERFACE.md § 8): the left-hand section a field's own row belongs to. `theme` has
 * no entry here — `GeneralSection.tsx` renders it directly from `buildSettingsRows`'s own `theme`
 * row, with a segmented control instead of a generic text field, so it never needs a section of
 * its own in this map. `'general'` still appears in `SettingsSection` itself (not just this map's
 * values) because `SettingsNav` renders one tab per `SettingsSection`, theme's own section
 * included.
 */
export type SettingsSection = 'general' | 'schedule' | 'capture' | 'discovery' | 'terminal';

export interface SettingsRow {
  readonly key: EditableConfigKey;
  /** docs/INTERFACE.md § 8's own "rótulos legíveis no lugar do nome da chave" —
   * `MESSAGES.settingsFieldLabels`'s own entry; the key itself still rides along (see `key` above)
   * for the mono hint next to the field, never dropped. */
  readonly label: string;
  readonly description: string;
  readonly value: string;
  readonly origin: SettingsValueOrigin;
  /** `null` only for `theme` (handled by its own segmented control, never a generic row) — every
   * other key always resolves to one of `SettingsSection`'s five generic values. */
  readonly section: SettingsSection | null;
}

/**
 * V2-T14's own "o que não entra": `projectPolicy` isn't scalar, so it never gets a `SettingsRow` —
 * it "aparece só para leitura, uma linha por cwd, e continua sendo editada pela CLI"
 * (`seeya config policy <cwd>`, unchanged). Same per-entry shape
 * `cli/config-command.ts#renderProjectPolicyLine` already prints, reimplemented here rather than
 * imported — `app/` and `cli/` are two independent composition roots that never import each other
 * (D-043) — a one-line format, not logic worth a shared module for.
 */
export interface ProjectPolicyLine {
  readonly cwd: string;
  readonly canTerminate: boolean;
  readonly deepCapture: boolean;
}

/**
 * V2-T65: one array per `SettingsSection`, same row order `EDITABLE_CONFIG_KEYS` already has —
 * `theme` (whose own row has `section: null`) never appears in any of these, `GeneralSection.tsx`
 * reads it directly off `rows` instead.
 *
 * @example
 * const bySection = groupSettingsRowsBySection(buildSettingsRows(config));
 * bySection.schedule; // [endOfDayTime, leadTimesInMinutes, overdueFireThresholdMinutes, ...]
 */
export function groupSettingsRowsBySection(
  rows: readonly SettingsRow[],
): Record<SettingsSection, readonly SettingsRow[]> {
  const bySection: Record<SettingsSection, SettingsRow[]> = {
    general: [],
    schedule: [],
    capture: [],
    discovery: [],
    terminal: [],
  };
  for (const row of rows) {
    if (row.section !== null) {
      bySection[row.section].push(row);
    }
  }
  return bySection;
}

/** `GeneralSection.tsx`'s own lookup for the one row it renders specially — thrown, never `null`
 * (D-025 doesn't apply here: `theme` is always one of `EDITABLE_CONFIG_KEYS`, so its row always
 * exists in anything `buildSettingsRows` produced; a missing one means the caller passed the wrong
 * array, a programming error worth a loud failure, not a silently empty control). */
export function findSettingsRow(rows: readonly SettingsRow[], key: EditableConfigKey): SettingsRow {
  const row = rows.find((entry) => entry.key === key);
  if (row === undefined) {
    throw new Error(
      `settings row "${key}" is missing from ${rows.length} row(s) — expected one of EDITABLE_CONFIG_KEYS.`,
    );
  }
  return row;
}
