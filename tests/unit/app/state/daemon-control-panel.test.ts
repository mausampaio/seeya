import { describe, expect, it } from 'vitest';
import {
  reduceDaemonControl,
  resolveDaemonControlAvailability,
  type DaemonControlState,
} from '../../../../packages/app/src/state/daemon-control-panel.js';
import type { LiveLockCheck } from '@seeya-ai/engine/scheduler/daemon-state.js';

const LOCK = { pid: 4242, startedAt: new Date(2026, 8, 17, 8, 0, 0), procStart: undefined };

describe('resolveDaemonControlAvailability', () => {
  it('noLock and dead both offer "start"', () => {
    const noLock: LiveLockCheck = { kind: 'noLock' };
    const dead: LiveLockCheck = { kind: 'dead', lock: LOCK };
    expect(resolveDaemonControlAvailability(noLock)).toEqual({ kind: 'start' });
    expect(resolveDaemonControlAvailability(dead)).toEqual({ kind: 'start' });
  });

  it('alive offers "stop", carrying the pid', () => {
    const alive: LiveLockCheck = { kind: 'alive', lock: LOCK };
    expect(resolveDaemonControlAvailability(alive)).toEqual({ kind: 'stop', pid: 4242 });
  });

  it('unknown never guesses which button would be safe (D-025)', () => {
    const unknown: LiveLockCheck = { kind: 'unknown', lock: LOCK, error: 'boom' };
    expect(resolveDaemonControlAvailability(unknown)).toEqual({ kind: 'unknown' });
  });
});

describe('reduceDaemonControl', () => {
  it('walks idle -> running -> result -> idle (next refresh tick)', () => {
    let state: DaemonControlState = { kind: 'idle', availability: { kind: 'start' } };

    state = reduceDaemonControl(state, { kind: 'clicked' });
    expect(state).toEqual({ kind: 'running', availability: { kind: 'start' } });

    state = reduceDaemonControl(state, {
      kind: 'finished',
      resultText: 'seeya daemon started (pid 4242)...',
    });
    expect(state).toEqual({
      kind: 'result',
      availability: { kind: 'start' },
      resultText: 'seeya daemon started (pid 4242)...',
    });

    state = reduceDaemonControl(state, {
      kind: 'availabilityUpdated',
      availability: { kind: 'stop', pid: 4242 },
    });
    expect(state).toEqual({ kind: 'idle', availability: { kind: 'stop', pid: 4242 } });
  });

  it('a refresh tick arriving WHILE running does not re-enable the button', () => {
    let state: DaemonControlState = { kind: 'idle', availability: { kind: 'start' } };
    state = reduceDaemonControl(state, { kind: 'clicked' });

    state = reduceDaemonControl(state, {
      kind: 'availabilityUpdated',
      availability: { kind: 'stop', pid: 4242 },
    });

    expect(state).toEqual({ kind: 'running', availability: { kind: 'start' } });
  });

  it('a second click while already running is a no-op', () => {
    let state: DaemonControlState = { kind: 'idle', availability: { kind: 'start' } };
    state = reduceDaemonControl(state, { kind: 'clicked' });
    const afterFirstClick = state;

    state = reduceDaemonControl(state, { kind: 'clicked' });

    expect(state).toEqual(afterFirstClick);
  });

  it('"finished" arriving outside "running" is ignored', () => {
    const state: DaemonControlState = { kind: 'idle', availability: { kind: 'start' } };
    expect(reduceDaemonControl(state, { kind: 'finished', resultText: 'stray' })).toBe(state);
  });
});
