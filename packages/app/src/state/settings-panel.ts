/**
 * V2-T14 item 1: "a lista, com a origem de cada valor" — one row per `EDITABLE_CONFIG_KEYS`
 * (`@seeya-ai/engine/adapters/storage/config-schema.js`, the exact list `seeya config get` already
 * walks — no second, parallel list that could drift, docs/PLANO-DE-ENTREGA.md V2-T14's own "sem
 * lista nova paralela que possa divergir"), with its current value and where it came from. Pure: no
 * I/O, no Electron, no DOM — `electron/main.ts` reads `Storage.readConfig()` and calls this; the
 * renderer only ever shows whatever `SettingsRow[]` comes back.
 *
 * **Origin, by comparing the resolved value against `DEFAULT_CONFIG` (D-025).**
 * `Storage.readConfig()` already merges `config.json` onto the defaults
 * (`adapters/storage/config-schema.ts#parseConfigDocument`) and throws away which fields the file
 * actually mentioned — there is no raw document left to ask "was this written on purpose". Comparing
 * the RESOLVED value against `DEFAULT_CONFIG` is exactly what the plan entry itself asks for
 * ("comparando o config.json lido com DEFAULT_CONFIG"): a value that happens to equal the default is
 * shown as `'default'`, even on the rare chance someone wrote that exact number into `config.json`
 * on purpose — the LESS specific claim D-025 asks for when the evidence can't tell the two apart,
 * never the more specific one it would be tempting to imagine.
 *
 * **V2-T65: only `main/main.ts` may import a VALUE from this file.** `DEFAULT_CONFIG`/
 * `EDITABLE_CONFIG_KEYS`/`formatConfigValue` are runtime imports from `@seeya-ai/engine/adapters/
 * storage/config-schema.js` — an `adapters/` module, not pure (it reads `process.platform` at its
 * own top level) — safe in `main/`'s Node context, but it broke the renderer bundle when a
 * renderer file imported a value from here (see `settings-fields.ts`'s own docstring for the full
 * production defect this fixes). Everything the RENDERER needs (`SettingsRow`/`ProjectPolicyLine`/
 * `SettingsSection`, `groupSettingsRowsBySection`, `findSettingsRow`) now lives in
 * `settings-fields.ts`, which has no such import — `renderer/features/settings/**` imports from
 * THAT file, never this one.
 */
import {
  DEFAULT_CONFIG,
  EDITABLE_CONFIG_KEYS,
  formatConfigValue,
  type EditableConfigKey,
} from '@seeya-ai/engine/adapters/storage/config-schema.js';
import type { Config } from '@seeya-ai/engine/core/types.js';
import { MESSAGES } from '../text/messages.js';
import {
  findSettingsRow,
  groupSettingsRowsBySection,
  type ProjectPolicyLine,
  type SettingsRow,
  type SettingsSection,
  type SettingsValueOrigin,
} from './settings-fields.js';

// Re-exported for every EXISTING caller of this module (`main/main.ts`, `ipc/channels.ts`, this
// file's own tests) — none of them need to change which module they import from; only new
// RENDERER code (V2-T65) reaches for `settings-fields.ts` directly, for the reason this file's own
// docstring explains.
export type {
  EditableConfigKey,
  ProjectPolicyLine,
  SettingsRow,
  SettingsSection,
  SettingsValueOrigin,
};
export { findSettingsRow, groupSettingsRowsBySection };

type GenericFieldKey = Exclude<EditableConfigKey, 'theme'>;

/** One entry per `EDITABLE_CONFIG_KEYS` minus `theme` — `buildSettingsRows`'s own test proves
 * every generic key has a section, the same completeness guarantee it already proves for
 * descriptions/labels. */
const SETTINGS_SECTION_BY_KEY: Record<GenericFieldKey, SettingsSection> = {
  endOfDayTime: 'schedule',
  leadTimesInMinutes: 'schedule',
  overdueFireThresholdMinutes: 'schedule',
  leadTimeHysteresisMinutes: 'schedule',
  captureModel: 'capture',
  budgetPerSessionUsd: 'capture',
  captureConcurrency: 'capture',
  forkCleanupDays: 'capture',
  maxGitRootsToVisit: 'capture',
  maxCaptureAttemptsPerSessionPerDay: 'capture',
  relevanceHours: 'discovery',
  idleMinutes: 'discovery',
  ignore: 'discovery',
  maxBriefingScanDays: 'discovery',
  terminalFontFamily: 'terminal',
  terminalFontSize: 'terminal',
};

function isGenericFieldKey(key: EditableConfigKey): key is GenericFieldKey {
  return key !== 'theme';
}

/** `leadTimesInMinutes`/`ignore` are the only array-shaped editable fields — every other one is a
 * plain scalar a bare `===` already compares correctly. Two arrays are the same value when they
 * have the same entries in the same order (`config-schema.ts` never reorders on read). */
function sameValue(a: Config[EditableConfigKey], b: Config[EditableConfigKey]): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

/**
 * @example
 * const rows = buildSettingsRows(await storage.readConfig());
 * rows[0]; // { key: 'endOfDayTime', description: '...', value: 'null', origin: 'default' }
 */
export function buildSettingsRows(config: Config): readonly SettingsRow[] {
  return EDITABLE_CONFIG_KEYS.map((key) => {
    const value = config[key];
    const origin: SettingsValueOrigin = sameValue(value, DEFAULT_CONFIG[key])
      ? 'default'
      : 'chosen';
    return {
      key,
      label: MESSAGES.settingsFieldLabels[key] ?? key,
      description: MESSAGES.settingsFieldDescriptions[key] ?? '',
      value: formatConfigValue(value),
      origin,
      section: isGenericFieldKey(key) ? SETTINGS_SECTION_BY_KEY[key] : null,
    };
  });
}

export function buildProjectPolicyLines(config: Config): readonly ProjectPolicyLine[] {
  return Object.entries(config.projectPolicy).map(([cwd, policy]) => ({
    cwd,
    canTerminate: policy.canTerminate,
    deepCapture: policy.deepCapture,
  }));
}
