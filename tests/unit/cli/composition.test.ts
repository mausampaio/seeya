/**
 * `packages/cli/src/composition.ts`'s own PURE helpers — everything else in that file wires real
 * adapters and is proven by `tests/integration/cli/composition.test.ts` instead (that file's own
 * module comment). `resolveCliHookEnv` (V2-T34, PO review defect 1) is parameterized specifically
 * so it doesn't need that: no real `process.versions.electron` mutation, no real port.
 */
import { describe, expect, it } from 'vitest';
import { resolveCliHookEnv } from '../../../packages/cli/src/composition.js';

describe('resolveCliHookEnv', () => {
  it('is empty for a plain Node process (no Electron version)', () => {
    expect(resolveCliHookEnv(undefined)).toEqual({});
  });

  it('carries ELECTRON_RUN_AS_NODE=1 when this seeya is itself running under Electron', () => {
    expect(resolveCliHookEnv('30.0.0')).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
  });
});
