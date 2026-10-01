import { describe, expect, it } from 'vitest';
import {
  describeEndDayFooterLabel,
  reduceEndDayPanel,
  type EndDayPanelState,
} from '../../../../packages/app/src/state/end-day-panel.js';
import type { EndDayCostCeiling } from '../../../../packages/app/src/state/end-day-preview.js';
import type {
  EndDayNotCapturedRow,
  EndDaySessionSummaryRow,
} from '../../../../packages/app/src/state/end-day-sessions.js';

const CEILING: EndDayCostCeiling = {
  sessionsInScope: 2,
  budgetPerSessionUsd: 0.5,
  captureModel: 'claude-3-5-sonnet',
  totalCeilingUsd: 1,
};

const ALPHA: EndDaySessionSummaryRow = {
  sessionId: 'alpha',
  name: 'alpha',
  cwd: '~/alpha',
  state: 'ended',
  mode: 'lean',
};

const BETA_INELIGIBLE: EndDayNotCapturedRow = {
  sessionId: 'beta',
  name: 'beta',
  cwd: '~/beta',
  kind: 'ineligible',
  reason: 'Already captured today with unchanged evidence.',
};

const GAMMA_CLOSED: EndDayNotCapturedRow = {
  sessionId: 'gamma',
  name: 'gamma',
  cwd: '~/gamma',
  kind: 'closed',
  reason: 'Session closed — no running process was found (D-031).',
};

describe('reduceEndDayPanel — the happy path (idle → preview → starting → running → result)', () => {
  it('walks the whole lifecycle in order, tracking two sessions by id', () => {
    let state: EndDayPanelState = { kind: 'idle' };

    state = reduceEndDayPanel(state, { kind: 'openClicked' });
    expect(state).toEqual({ kind: 'previewPending' });

    state = reduceEndDayPanel(state, {
      kind: 'previewReady',
      willBeCaptured: [ALPHA],
      notCaptured: [BETA_INELIGIBLE, GAMMA_CLOSED],
      costCeiling: CEILING,
    });
    expect(state).toEqual({
      kind: 'preview',
      willBeCaptured: [ALPHA],
      notCaptured: [BETA_INELIGIBLE, GAMMA_CLOSED],
      costCeiling: CEILING,
    });

    state = reduceEndDayPanel(state, { kind: 'runClicked' });
    expect(state).toEqual({
      kind: 'starting',
      willBeCaptured: [ALPHA],
      notCaptured: [BETA_INELIGIBLE, GAMMA_CLOSED],
      costCeiling: CEILING,
    });

    // The first progress event seeds the running view — alpha AND beta (ineligible, still went
    // through runSession) are tracked; gamma (closed, D-031) never is.
    state = reduceEndDayPanel(state, {
      kind: 'sessionStarted',
      sessionId: 'alpha',
      name: 'alpha',
      index: 1,
      total: 2,
    });
    expect(state).toEqual({
      kind: 'running',
      visible: true,
      current: { index: 1, total: 2, name: 'alpha' },
      sessions: [
        { sessionId: 'alpha', name: 'alpha', status: 'capturing' },
        { sessionId: 'beta', name: 'beta', status: 'waiting' },
      ],
    });

    state = reduceEndDayPanel(state, {
      kind: 'sessionFinished',
      sessionId: 'alpha',
      outcome: 'captured',
    });
    state = reduceEndDayPanel(state, {
      kind: 'sessionStarted',
      sessionId: 'beta',
      name: 'beta',
      index: 2,
      total: 2,
    });
    state = reduceEndDayPanel(state, {
      kind: 'sessionFinished',
      sessionId: 'beta',
      outcome: 'ineligible',
    });
    expect(state).toEqual({
      kind: 'running',
      visible: true,
      current: { index: 2, total: 2, name: 'beta' },
      sessions: [
        { sessionId: 'alpha', name: 'alpha', status: 'captured' },
        { sessionId: 'beta', name: 'beta', status: 'ineligible' },
      ],
    });

    state = reduceEndDayPanel(state, {
      kind: 'runFinished',
      captured: [ALPHA],
      failed: [],
      skipped: [{ sessionId: 'beta', name: 'beta', cwd: '~/beta', reason: 'already captured' }],
    });
    expect(state).toEqual({
      kind: 'result',
      visible: true,
      captured: [ALPHA],
      failed: [],
      skipped: [{ sessionId: 'beta', name: 'beta', cwd: '~/beta', reason: 'already captured' }],
    });

    state = reduceEndDayPanel(state, { kind: 'closed' });
    expect(state).toEqual({ kind: 'idle' });
  });

  it('runFinished can land directly from "starting" — zero sessions in scope, no progress events', () => {
    const starting: EndDayPanelState = {
      kind: 'starting',
      willBeCaptured: [],
      notCaptured: [],
      costCeiling: { ...CEILING, sessionsInScope: 0, totalCeilingUsd: 0 },
    };
    const state = reduceEndDayPanel(starting, {
      kind: 'runFinished',
      captured: [],
      failed: [],
      skipped: [],
    });
    expect(state).toEqual({ kind: 'result', visible: true, captured: [], failed: [], skipped: [] });
  });

  it('a sessionStarted for an id the preview never seeded is appended, not dropped (D-025)', () => {
    const starting: EndDayPanelState = {
      kind: 'starting',
      willBeCaptured: [],
      notCaptured: [],
      costCeiling: CEILING,
    };
    const state = reduceEndDayPanel(starting, {
      kind: 'sessionStarted',
      sessionId: 'surprise',
      name: 'surprise',
      index: 1,
      total: 1,
    });
    expect(state).toEqual({
      kind: 'running',
      visible: true,
      current: { index: 1, total: 1, name: 'surprise' },
      sessions: [{ sessionId: 'surprise', name: 'surprise', status: 'capturing' }],
    });
  });
});

describe('reduceEndDayPanel — hide and reopen', () => {
  const running: EndDayPanelState = {
    kind: 'running',
    visible: true,
    current: { index: 1, total: 1, name: 'alpha' },
    sessions: [{ sessionId: 'alpha', name: 'alpha', status: 'capturing' }],
  };

  it('hidden keeps the phase and its data, only flips visible', () => {
    expect(reduceEndDayPanel(running, { kind: 'hidden' })).toEqual({ ...running, visible: false });
  });

  it('reopened flips it back', () => {
    const hidden = { ...running, visible: false };
    expect(reduceEndDayPanel(hidden, { kind: 'reopened' })).toEqual({ ...hidden, visible: true });
  });

  it('a hidden run keeps updating sessions in the background', () => {
    const hidden = { ...running, visible: false };
    const updated = reduceEndDayPanel(hidden, {
      kind: 'sessionFinished',
      sessionId: 'alpha',
      outcome: 'captured',
    });
    expect(updated).toEqual({
      ...hidden,
      sessions: [{ sessionId: 'alpha', name: 'alpha', status: 'captured' }],
    });
  });

  it('hidden on a result phase works the same way', () => {
    const result: EndDayPanelState = {
      kind: 'result',
      visible: true,
      captured: [],
      failed: [],
      skipped: [],
    };
    expect(reduceEndDayPanel(result, { kind: 'hidden' })).toEqual({ ...result, visible: false });
  });

  it('hidden/reopened are no-ops outside running/result', () => {
    expect(reduceEndDayPanel({ kind: 'idle' }, { kind: 'hidden' })).toEqual({ kind: 'idle' });
    expect(reduceEndDayPanel({ kind: 'idle' }, { kind: 'reopened' })).toEqual({ kind: 'idle' });
  });
});

describe('reduceEndDayPanel — cancelling', () => {
  it('cancelled from previewPending goes to idle', () => {
    expect(reduceEndDayPanel({ kind: 'previewPending' }, { kind: 'cancelled' })).toEqual({
      kind: 'idle',
    });
  });

  it('cancelled from preview goes to idle — "fechar sem escolher é cancelar"', () => {
    const state = reduceEndDayPanel(
      { kind: 'preview', willBeCaptured: [], notCaptured: [], costCeiling: CEILING },
      { kind: 'cancelled' },
    );
    expect(state).toEqual({ kind: 'idle' });
  });
});

describe('reduceEndDayPanel — disallowed transitions are ignored, not thrown (defense in depth)', () => {
  it('a second openClicked while previewPending does not restart the fetch', () => {
    expect(reduceEndDayPanel({ kind: 'previewPending' }, { kind: 'openClicked' })).toEqual({
      kind: 'previewPending',
    });
  });

  it('runClicked from idle changes nothing', () => {
    expect(reduceEndDayPanel({ kind: 'idle' }, { kind: 'runClicked' })).toEqual({ kind: 'idle' });
  });

  it('a stray sessionFinished after the run already finished is ignored', () => {
    const result: EndDayPanelState = {
      kind: 'result',
      visible: true,
      captured: [],
      failed: [],
      skipped: [],
    };
    expect(
      reduceEndDayPanel(result, {
        kind: 'sessionFinished',
        sessionId: 'alpha',
        outcome: 'captured',
      }),
    ).toEqual(result);
  });

  const RUNNING_FIXTURE: EndDayPanelState = {
    kind: 'running',
    visible: true,
    sessions: [],
    current: { index: 1, total: 1, name: 'alpha' },
  };

  it('cancelled from running (nothing to cancel mid-run) changes nothing', () => {
    expect(reduceEndDayPanel(RUNNING_FIXTURE, { kind: 'cancelled' })).toEqual(RUNNING_FIXTURE);
  });

  it('closed from idle stays idle', () => {
    expect(reduceEndDayPanel({ kind: 'idle' }, { kind: 'closed' })).toEqual({ kind: 'idle' });
  });

  it('closed from running does nothing — Hide, not Close, is the only way out of a live run', () => {
    expect(reduceEndDayPanel(RUNNING_FIXTURE, { kind: 'closed' })).toEqual(RUNNING_FIXTURE);
  });
});

describe('describeEndDayFooterLabel', () => {
  it('idle reads as the plain trigger', () => {
    expect(describeEndDayFooterLabel({ kind: 'idle' })).toBe('End day…');
  });

  it('a visible running dialog still reads as the plain trigger (nothing hidden to surface)', () => {
    const state: EndDayPanelState = {
      kind: 'running',
      visible: true,
      sessions: [],
      current: { index: 1, total: 2, name: 'alpha' },
    };
    expect(describeEndDayFooterLabel(state)).toBe('End day…');
  });

  it('a hidden running dialog with progress reads "Capturing i of N…"', () => {
    const state: EndDayPanelState = {
      kind: 'running',
      visible: false,
      sessions: [],
      current: { index: 2, total: 5, name: 'alpha' },
    };
    expect(describeEndDayFooterLabel(state)).toBe('Capturing 2 of 5…');
  });

  it('a hidden finished result reads "finished — view results"', () => {
    const state: EndDayPanelState = {
      kind: 'result',
      visible: false,
      captured: [],
      failed: [],
      skipped: [],
    };
    expect(describeEndDayFooterLabel(state)).toBe('End day finished — view results');
  });

  it('a VISIBLE finished result reads as the plain trigger (the dialog already shows it)', () => {
    const state: EndDayPanelState = {
      kind: 'result',
      visible: true,
      captured: [],
      failed: [],
      skipped: [],
    };
    expect(describeEndDayFooterLabel(state)).toBe('End day…');
  });
});
