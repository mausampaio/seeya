import { describe, expect, it } from 'vitest';
import {
  reduceAdoptPanel,
  type AdoptionSessionCard,
  type AdoptPanelState,
} from '../../../../packages/app/src/state/adopt-panel.js';

const SESSION: AdoptionSessionCard = {
  sessionId: 's1',
  name: 'session-one',
  displaySessionId: 's1',
  cwd: '/code/x',
  state: 'ended',
  stateLabel: 'ended',
};

describe('reduceAdoptPanel (V2-T70)', () => {
  it('the full happy path: pick -> submit (dialog closes, launching) -> commit confirm -> answered -> result -> closed', () => {
    let state: AdoptPanelState = { kind: 'idle' };

    state = reduceAdoptPanel(state, { kind: 'pickerOpened', session: SESSION });
    expect(state).toEqual({ kind: 'pickProject', session: SESSION });

    state = reduceAdoptPanel(state, { kind: 'pickerSubmitted' });
    expect(state).toEqual({ kind: 'launching' });

    state = reduceAdoptPanel(state, {
      kind: 'commitRequestReceived',
      requestId: 'adopt-commit-1',
      entries: [{ kind: 'added', path: 'AGENTS.md', lines: null }],
    });
    expect(state.kind).toBe('commitConfirm');

    state = reduceAdoptPanel(state, { kind: 'commitAnswered' });
    expect(state).toEqual({ kind: 'launching' });

    state = reduceAdoptPanel(state, {
      kind: 'resultReceived',
      outcomeText: 'Project "x": adopted.',
      adopted: true,
      projectId: 'x',
    });
    expect(state).toEqual({
      kind: 'result',
      outcomeText: 'Project "x": adopted.',
      adopted: true,
      projectId: 'x',
    });

    state = reduceAdoptPanel(state, { kind: 'resultClosed' });
    expect(state).toEqual({ kind: 'idle' });
  });

  it('cancelling the picker returns to idle without ever submitting', () => {
    let state: AdoptPanelState = { kind: 'idle' };
    state = reduceAdoptPanel(state, { kind: 'pickerOpened', session: SESSION });

    state = reduceAdoptPanel(state, { kind: 'pickerCancelled' });

    expect(state).toEqual({ kind: 'idle' });
  });

  it('a result can arrive without ever going through commitConfirm (noChanges/declined/failures)', () => {
    let state: AdoptPanelState = { kind: 'idle' };
    state = reduceAdoptPanel(state, { kind: 'pickerOpened', session: SESSION });
    state = reduceAdoptPanel(state, { kind: 'pickerSubmitted' });

    state = reduceAdoptPanel(state, {
      kind: 'resultReceived',
      outcomeText: 'Project "x": the session didn\'t write anything inside the project.',
      adopted: false,
      projectId: 'x',
    });

    expect(state.kind).toBe('result');
  });

  it('unrecognized/out-of-order local transitions are ignored, never thrown', () => {
    const state: AdoptPanelState = { kind: 'idle' };

    expect(reduceAdoptPanel(state, { kind: 'commitAnswered' })).toEqual(state);
    expect(reduceAdoptPanel(state, { kind: 'resultClosed' })).toEqual(state);
    expect(reduceAdoptPanel(state, { kind: 'pickerSubmitted' })).toEqual(state);
  });

  it('a second pickerOpened while one is already open (or a fork is launching) is ignored', () => {
    let state: AdoptPanelState = { kind: 'idle' };
    state = reduceAdoptPanel(state, { kind: 'pickerOpened', session: SESSION });

    const unchanged = reduceAdoptPanel(state, {
      kind: 'pickerOpened',
      session: { ...SESSION, sessionId: 's2' },
    });
    expect(unchanged).toEqual(state);

    const launching = reduceAdoptPanel(state, { kind: 'pickerSubmitted' });
    const stillLaunching = reduceAdoptPanel(launching, {
      kind: 'pickerOpened',
      session: { ...SESSION, sessionId: 's3' },
    });
    expect(stillLaunching).toEqual(launching);
  });

  it('commitRequestReceived is accepted from any state (D-025: a legitimate push is never dropped)', () => {
    const idle: AdoptPanelState = { kind: 'idle' };
    const result = reduceAdoptPanel(idle, {
      kind: 'commitRequestReceived',
      requestId: 'r1',
      entries: [],
    });
    expect(result).toEqual({ kind: 'commitConfirm', requestId: 'r1', entries: [] });
  });
});
