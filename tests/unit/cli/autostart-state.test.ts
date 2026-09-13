import { describe, expect, it } from 'vitest';
import { describeAutostartState } from '../../../src/cli/autostart-state.js';
import { FakeAutostart } from './_autostart-fakes.js';

describe('describeAutostartState', () => {
  it('disabled', async () => {
    const report = await describeAutostartState(new FakeAutostart({ kind: 'disabled' }));
    expect(report).toBe('Autostart: disabled.');
  });

  it('enabled — names the registered path', async () => {
    const report = await describeAutostartState(
      new FakeAutostart({
        kind: 'enabled',
        registeredPath: 'c:\\code\\seeya\\dist\\cli\\index.js',
      }),
    );
    expect(report).toBe('Autostart: enabled (c:\\code\\seeya\\dist\\cli\\index.js).');
  });

  it('brokenPath — names the stale path and suggests re-running enable (the 2026-09-13 rename case)', async () => {
    const report = await describeAutostartState(
      new FakeAutostart({
        kind: 'brokenPath',
        registeredPath: 'c:\\code\\see-you-tomorrow\\dist\\cli\\index.js',
      }),
    );
    expect(report).toContain('the registered path no longer exists');
    expect(report).toContain('c:\\code\\see-you-tomorrow\\dist\\cli\\index.js');
    expect(report).toContain('seeya autostart enable');
  });

  it('unknown — names the raw error, never guesses on/off (D-025)', async () => {
    const report = await describeAutostartState(
      new FakeAutostart({ kind: 'unknown', error: 'Access is denied.' }),
    );
    expect(report).toBe('Autostart: could not verify (Access is denied.).');
  });
});
