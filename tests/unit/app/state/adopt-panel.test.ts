import { describe, expect, it } from 'vitest';
import {
  reduceAdoptPanel,
  type AdoptPanelState,
} from '../../../../packages/app/src/state/adopt-panel.js';

describe('reduceAdoptPanel (V2-T30 item 5)', () => {
  it('the full happy path: pick -> submit (dialog closes) -> launch confirm -> answered -> commit confirm -> answered -> result -> closed', () => {
    let state: AdoptPanelState = { kind: 'idle' };

    state = reduceAdoptPanel(state, {
      kind: 'pickerOpened',
      sessionId: 's1',
      sessionName: 'session-one',
    });
    expect(state).toEqual({ kind: 'pickProject', sessionId: 's1', sessionName: 'session-one' });

    state = reduceAdoptPanel(state, { kind: 'pickerSubmitted' });
    expect(state).toEqual({ kind: 'idle' });

    state = reduceAdoptPanel(state, {
      kind: 'launchRequestReceived',
      requestId: 'adopt-launch-1',
      explanationLines: ['line 1'],
    });
    expect(state.kind).toBe('launchConfirm');

    state = reduceAdoptPanel(state, { kind: 'launchAnswered' });
    expect(state).toEqual({ kind: 'idle' });

    state = reduceAdoptPanel(state, {
      kind: 'commitRequestReceived',
      requestId: 'adopt-commit-1',
      changedFilesLines: ['AGENTS.md'],
    });
    expect(state.kind).toBe('commitConfirm');

    state = reduceAdoptPanel(state, { kind: 'commitAnswered' });
    expect(state).toEqual({ kind: 'idle' });

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

  it('cancelling the picker returns to idle without ever contacting main', () => {
    let state: AdoptPanelState = { kind: 'idle' };
    state = reduceAdoptPanel(state, { kind: 'pickerOpened', sessionId: 's1', sessionName: 'x' });

    state = reduceAdoptPanel(state, { kind: 'pickerCancelled' });

    expect(state).toEqual({ kind: 'idle' });
  });

  it('unrecognized/out-of-order local transitions are ignored, never thrown', () => {
    const state: AdoptPanelState = { kind: 'idle' };

    expect(reduceAdoptPanel(state, { kind: 'launchAnswered' })).toEqual(state);
    expect(reduceAdoptPanel(state, { kind: 'commitAnswered' })).toEqual(state);
    expect(reduceAdoptPanel(state, { kind: 'resultClosed' })).toEqual(state);
    expect(reduceAdoptPanel(state, { kind: 'pickerSubmitted' })).toEqual(state);
  });

  it('a second pickerOpened while one is already open is ignored (one flow at a time)', () => {
    let state: AdoptPanelState = { kind: 'idle' };
    state = reduceAdoptPanel(state, { kind: 'pickerOpened', sessionId: 's1', sessionName: 'x' });

    const unchanged = reduceAdoptPanel(state, {
      kind: 'pickerOpened',
      sessionId: 's2',
      sessionName: 'y',
    });

    expect(unchanged).toEqual(state);
  });
});
