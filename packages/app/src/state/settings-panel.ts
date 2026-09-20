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
 */
import {
  DEFAULT_CONFIG,
  EDITABLE_CONFIG_KEYS,
  formatConfigValue,
  type EditableConfigKey,
} from '@seeya-ai/engine/adapters/storage/config-schema.js';
import type { Config } from '@seeya-ai/engine/core/types.js';
import { MESSAGES } from '../text/messages.js';

export type SettingsValueOrigin = 'default' | 'chosen';

export interface SettingsRow {
  readonly key: EditableConfigKey;
  readonly description: string;
  readonly value: string;
  readonly origin: SettingsValueOrigin;
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
      description: MESSAGES.settingsFieldDescriptions[key] ?? '',
      value: formatConfigValue(value),
      origin,
    };
  });
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

export function buildProjectPolicyLines(config: Config): readonly ProjectPolicyLine[] {
  return Object.entries(config.projectPolicy).map(([cwd, policy]) => ({
    cwd,
    canTerminate: policy.canTerminate,
    deepCapture: policy.deepCapture,
  }));
}
