/**
 * `core/autostart.ts` (docs/PLANO-DE-ENTREGA.md S5-T1) — pure decision layer, no OS mechanism
 * touched here (`adapters/autostart/*.test.ts` cover the per-OS wiring against injected fakes).
 */
import { describe, expect, it } from 'vitest';
import {
  classifyAutostartStatus,
  decideAutostartEnable,
  type AutostartRawQuery,
} from '@seeya-ai/engine/core/autostart.js';

const NOT_REGISTERED: AutostartRawQuery = { registered: false };
const REGISTERED = (registeredPath: string): AutostartRawQuery => ({
  registered: true,
  registeredPath,
});

describe('classifyAutostartStatus', () => {
  it('nothing registered → disabled, regardless of pathExists', () => {
    expect(classifyAutostartStatus(NOT_REGISTERED, true)).toEqual({ kind: 'disabled' });
    expect(classifyAutostartStatus(NOT_REGISTERED, false)).toEqual({ kind: 'disabled' });
  });

  it('registered and the path still exists → enabled, carrying the path', () => {
    expect(
      classifyAutostartStatus(REGISTERED('c:\\code\\seeya\\dist\\cli\\index.js'), true),
    ).toEqual({
      kind: 'enabled',
      registeredPath: 'c:\\code\\seeya\\dist\\cli\\index.js',
    });
  });

  it('registered but the path no longer exists → brokenPath, carrying the stale path (D-024, the 2026-09-13 rename case)', () => {
    expect(
      classifyAutostartStatus(REGISTERED('c:\\code\\see-you-tomorrow\\dist\\cli\\index.js'), false),
    ).toEqual({
      kind: 'brokenPath',
      registeredPath: 'c:\\code\\see-you-tomorrow\\dist\\cli\\index.js',
    });
  });
});

describe('decideAutostartEnable', () => {
  const NEW_PATH = 'c:\\code\\seeya\\dist\\cli\\index.js';

  it('nothing registered yet → registered', () => {
    expect(decideAutostartEnable(NOT_REGISTERED, NEW_PATH)).toEqual({
      kind: 'registered',
      path: NEW_PATH,
    });
  });

  it('already registered at the exact same path → alreadyRegistered, never duplicated', () => {
    expect(decideAutostartEnable(REGISTERED(NEW_PATH), NEW_PATH)).toEqual({
      kind: 'alreadyRegistered',
      path: NEW_PATH,
    });
  });

  it('registered at a different path → updated, naming both the old and the new path', () => {
    const oldPath = 'c:\\code\\see-you-tomorrow\\dist\\cli\\index.js';
    expect(decideAutostartEnable(REGISTERED(oldPath), NEW_PATH)).toEqual({
      kind: 'updated',
      previousPath: oldPath,
      newPath: NEW_PATH,
    });
  });
});
