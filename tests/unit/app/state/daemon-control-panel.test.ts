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
      availability: { kind: 'stop', pid: 4242 },
    });
    expect(state).toEqual({
      kind: 'result',
      availability: { kind: 'stop', pid: 4242 },
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
    expect(
      reduceDaemonControl(state, {
        kind: 'finished',
        resultText: 'stray',
        availability: { kind: 'stop', pid: 4242 },
      }),
    ).toBe(state);
  });

  /**
   * V2-T21 item 1 — the measured defect: stopping the daemon left the button reading "Start
   * daemon" but a click WOULD have sent 'stop' again (`state.availability` from before the
   * click), because `finished` used to keep the pre-click availability. The response's own
   * recomputed availability now lands in `result`, and a click from THAT state is what proves the
   * next click sends the right action, without waiting for the next ambient tick.
   */
  it('a click right after the previous result sends the freshly recomputed action, not the stale one', () => {
    let state: DaemonControlState = { kind: 'idle', availability: { kind: 'stop', pid: 4242 } };
    state = reduceDaemonControl(state, { kind: 'clicked' });
    expect(state).toEqual({ kind: 'running', availability: { kind: 'stop', pid: 4242 } });

    state = reduceDaemonControl(state, {
      kind: 'finished',
      resultText: 'seeya daemon stopped.',
      availability: { kind: 'start' },
    });
    expect(state).toEqual({
      kind: 'result',
      availability: { kind: 'start' },
      resultText: 'seeya daemon stopped.',
    });

    // The button now reads "Start daemon" — clicking again, before any refresh tick, must send
    // 'start', never the stale 'stop' the mantenedor measured.
    state = reduceDaemonControl(state, { kind: 'clicked' });
    expect(state).toEqual({ kind: 'running', availability: { kind: 'start' } });
  });
});
