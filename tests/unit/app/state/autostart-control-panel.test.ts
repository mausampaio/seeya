import { describe, expect, it } from 'vitest';
import {
  reduceAutostartControl,
  resolveAutostartControlAvailability,
  type AutostartControlState,
} from '../../../../packages/app/src/state/autostart-control-panel.js';
import type { AutostartStatus } from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwner } from '@seeya-ai/engine/core/types.js';

const APP_OWNER: DaemonOwner = { kind: 'app', launchPath: 'C:\\seeya\\seeya.exe' };
const CLI_OWNER: DaemonOwner = { kind: 'cli' };
const UNKNOWN_OWNER: DaemonOwner = { kind: 'unknown' };

describe('resolveAutostartControlAvailability', () => {
  it('owner is cli → notApplicable, regardless of status', () => {
    const status: AutostartStatus = { kind: 'disabled' };
    expect(resolveAutostartControlAvailability(CLI_OWNER, status)).toEqual({
      kind: 'notApplicable',
    });
  });

  it('owner is unknown → notApplicable, regardless of status (D-025)', () => {
    const status: AutostartStatus = { kind: 'enabled', registeredPath: 'C:\\seeya\\seeya.exe' };
    expect(resolveAutostartControlAvailability(UNKNOWN_OWNER, status)).toEqual({
      kind: 'notApplicable',
    });
  });

  it('owner is app, status disabled → enable', () => {
    const status: AutostartStatus = { kind: 'disabled' };
    expect(resolveAutostartControlAvailability(APP_OWNER, status)).toEqual({ kind: 'enable' });
  });

  it('owner is app, status enabled → disable', () => {
    const status: AutostartStatus = { kind: 'enabled', registeredPath: 'C:\\seeya\\seeya.exe' };
    expect(resolveAutostartControlAvailability(APP_OWNER, status)).toEqual({ kind: 'disable' });
  });

  it('owner is app, status brokenPath → disable (something is registered, even if stale)', () => {
    const status: AutostartStatus = { kind: 'brokenPath', registeredPath: 'C:\\old\\seeya.exe' };
    expect(resolveAutostartControlAvailability(APP_OWNER, status)).toEqual({ kind: 'disable' });
  });

  it('owner is app, status unknown → unknown, never guessed either way (D-025)', () => {
    const status: AutostartStatus = { kind: 'unknown', error: 'boom' };
    expect(resolveAutostartControlAvailability(APP_OWNER, status)).toEqual({ kind: 'unknown' });
  });
});

describe('reduceAutostartControl', () => {
  it('walks idle -> running -> result -> idle (next refresh tick)', () => {
    let state: AutostartControlState = { kind: 'idle', availability: { kind: 'enable' } };

    state = reduceAutostartControl(state, { kind: 'clicked' });
    expect(state).toEqual({ kind: 'running', availability: { kind: 'enable' } });

    state = reduceAutostartControl(state, {
      kind: 'finished',
      resultText: 'Autostart enabled: seeya daemon will now start on login...',
    });
    expect(state).toEqual({
      kind: 'result',
      availability: { kind: 'enable' },
      resultText: 'Autostart enabled: seeya daemon will now start on login...',
    });

    state = reduceAutostartControl(state, {
      kind: 'availabilityUpdated',
      availability: { kind: 'disable' },
    });
    expect(state).toEqual({ kind: 'idle', availability: { kind: 'disable' } });
  });

  it('a refresh tick arriving WHILE running does not re-enable the button', () => {
    let state: AutostartControlState = { kind: 'idle', availability: { kind: 'enable' } };
    state = reduceAutostartControl(state, { kind: 'clicked' });

    state = reduceAutostartControl(state, {
      kind: 'availabilityUpdated',
      availability: { kind: 'disable' },
    });

    expect(state).toEqual({ kind: 'running', availability: { kind: 'enable' } });
  });

  it('clicking while notApplicable is a no-op — the button should never be shown clickable then', () => {
    const state: AutostartControlState = { kind: 'idle', availability: { kind: 'notApplicable' } };
    expect(reduceAutostartControl(state, { kind: 'clicked' })).toBe(state);
  });

  it('clicking while unknown is a no-op, same as notApplicable', () => {
    const state: AutostartControlState = { kind: 'idle', availability: { kind: 'unknown' } };
    expect(reduceAutostartControl(state, { kind: 'clicked' })).toBe(state);
  });

  it('a second click while already running is a no-op', () => {
    let state: AutostartControlState = { kind: 'idle', availability: { kind: 'enable' } };
    state = reduceAutostartControl(state, { kind: 'clicked' });
    const afterFirstClick = state;

    state = reduceAutostartControl(state, { kind: 'clicked' });

    expect(state).toEqual(afterFirstClick);
  });

  it('"finished" arriving outside "running" is ignored', () => {
    const state: AutostartControlState = { kind: 'idle', availability: { kind: 'enable' } };
    expect(reduceAutostartControl(state, { kind: 'finished', resultText: 'stray' })).toBe(state);
  });
});
