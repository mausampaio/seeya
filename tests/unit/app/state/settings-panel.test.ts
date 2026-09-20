import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  EDITABLE_CONFIG_KEYS,
} from '@seeya-ai/engine/adapters/storage/config-schema.js';
import {
  buildSettingsRows,
  buildProjectPolicyLines,
} from '../../../../packages/app/src/state/settings-panel.js';

describe('buildSettingsRows', () => {
  it('one row per EDITABLE_CONFIG_KEYS, same order — never a second, drifting list', () => {
    const rows = buildSettingsRows(DEFAULT_CONFIG);
    expect(rows.map((row) => row.key)).toEqual([...EDITABLE_CONFIG_KEYS]);
  });

  it('every row has a non-empty description — catches a key added to config-schema.ts without a matching entry in text/messages.ts', () => {
    const rows = buildSettingsRows(DEFAULT_CONFIG);
    for (const row of rows) {
      expect(row.description.length, `missing description for "${row.key}"`).toBeGreaterThan(0);
    }
  });

  it('the default config resolves every row to origin "default"', () => {
    const rows = buildSettingsRows(DEFAULT_CONFIG);
    for (const row of rows) {
      expect(row.origin, `expected "${row.key}" to be default`).toBe('default');
    }
  });

  it('a scalar field that differs from the default is "chosen"', () => {
    const rows = buildSettingsRows({ ...DEFAULT_CONFIG, endOfDayTime: '19:30' });
    const row = rows.find((entry) => entry.key === 'endOfDayTime');
    expect(row?.value).toBe('19:30');
    expect(row?.origin).toBe('chosen');
  });

  it('endOfDayTime null (the actual default) still reads as "default", not "chosen"', () => {
    const rows = buildSettingsRows(DEFAULT_CONFIG);
    const row = rows.find((entry) => entry.key === 'endOfDayTime');
    expect(row?.value).toBe('null');
    expect(row?.origin).toBe('default');
  });

  it('an array field with the exact same entries as the default is "default", not "chosen"', () => {
    const rows = buildSettingsRows({
      ...DEFAULT_CONFIG,
      leadTimesInMinutes: [...DEFAULT_CONFIG.leadTimesInMinutes],
    });
    const row = rows.find((entry) => entry.key === 'leadTimesInMinutes');
    expect(row?.origin).toBe('default');
  });

  it('an array field that differs from the default (a different value, a different length) is "chosen"', () => {
    const rows = buildSettingsRows({ ...DEFAULT_CONFIG, leadTimesInMinutes: [45] });
    const row = rows.find((entry) => entry.key === 'leadTimesInMinutes');
    expect(row?.value).toBe('45');
    expect(row?.origin).toBe('chosen');
  });

  it('an empty ignore list formats as "(empty)", same as seeya config get', () => {
    const rows = buildSettingsRows(DEFAULT_CONFIG);
    const row = rows.find((entry) => entry.key === 'ignore');
    expect(row?.value).toBe('(empty)');
    expect(row?.origin).toBe('default');
  });

  it('projectPolicy and schemaVersion never appear — they are not in EDITABLE_CONFIG_KEYS', () => {
    const rows = buildSettingsRows(DEFAULT_CONFIG);
    expect(rows.some((row) => (row.key as string) === 'projectPolicy')).toBe(false);
    expect(rows.some((row) => (row.key as string) === 'schemaVersion')).toBe(false);
  });
});

describe('buildProjectPolicyLines', () => {
  it('no projectPolicy entries — an empty list', () => {
    expect(buildProjectPolicyLines(DEFAULT_CONFIG)).toEqual([]);
  });

  it('one line per cwd, carrying canTerminate/deepCapture through unchanged', () => {
    const config = {
      ...DEFAULT_CONFIG,
      projectPolicy: {
        '/repo/one': { canTerminate: true, deepCapture: false },
        '/repo/two': { canTerminate: false, deepCapture: true },
      },
    };
    expect(buildProjectPolicyLines(config)).toEqual([
      { cwd: '/repo/one', canTerminate: true, deepCapture: false },
      { cwd: '/repo/two', canTerminate: false, deepCapture: true },
    ]);
  });
});
