import { describe, expect, it } from 'vitest';
import {
  reduceEndDayPanel,
  type EndDayPanelState,
} from '../../../../packages/app/src/state/end-day-panel.js';
import type { EndDayCostCeiling } from '../../../../packages/app/src/state/end-day-preview.js';

const CEILING: EndDayCostCeiling = {
  sessionsInScope: 2,
  budgetPerSessionUsd: 0.5,
  captureModel: 'claude-3-5-sonnet',
  totalCeilingUsd: 1,
};

describe('reduceEndDayPanel — the happy path (idle → preview → running → result)', () => {
  it('walks the whole lifecycle in order', () => {
    let state: EndDayPanelState = { kind: 'idle' };

    state = reduceEndDayPanel(state, { kind: 'openClicked' });
    expect(state).toEqual({ kind: 'previewPending' });

    state = reduceEndDayPanel(state, {
      kind: 'previewReady',
      reportText: 'seeya end-day — 2026-09-16 (dry run)',
      costCeiling: CEILING,
    });
    expect(state).toEqual({
      kind: 'preview',
      reportText: 'seeya end-day — 2026-09-16 (dry run)',
      costCeiling: CEILING,
    });

    state = reduceEndDayPanel(state, { kind: 'runClicked' });
    expect(state).toEqual({ kind: 'running', progressText: null });

    state = reduceEndDayPanel(state, {
      kind: 'progress',
      progressText: 'Capturing 1 of 2: alpha...',
    });
    expect(state).toEqual({ kind: 'running', progressText: 'Capturing 1 of 2: alpha...' });

    state = reduceEndDayPanel(state, {
      kind: 'runFinished',
      reportText: 'seeya end-day — 2026-09-16',
    });
    expect(state).toEqual({ kind: 'result', reportText: 'seeya end-day — 2026-09-16' });

    state = reduceEndDayPanel(state, { kind: 'closed' });
    expect(state).toEqual({ kind: 'idle' });
  });
});

describe('reduceEndDayPanel — cancelling', () => {
  it('cancelled from previewPending (closed the dialog while the preview was still loading) goes to idle', () => {
    const state = reduceEndDayPanel({ kind: 'previewPending' }, { kind: 'cancelled' });
    expect(state).toEqual({ kind: 'idle' });
  });

  it('cancelled from preview goes to idle — "fechar sem escolher é cancelar"', () => {
    const state = reduceEndDayPanel(
      { kind: 'preview', reportText: 'x', costCeiling: CEILING },
      { kind: 'cancelled' },
    );
    expect(state).toEqual({ kind: 'idle' });
  });
});

describe('reduceEndDayPanel — disallowed transitions are ignored, not thrown (defense in depth)', () => {
  it('a second openClicked while previewPending does not restart the fetch', () => {
    const state = reduceEndDayPanel({ kind: 'previewPending' }, { kind: 'openClicked' });
    expect(state).toEqual({ kind: 'previewPending' });
  });

  it('runClicked from idle (no preview to confirm) changes nothing', () => {
    const state = reduceEndDayPanel({ kind: 'idle' }, { kind: 'runClicked' });
    expect(state).toEqual({ kind: 'idle' });
  });

  it('a stray progress event after the run already finished is ignored', () => {
    const state = reduceEndDayPanel(
      { kind: 'result', reportText: 'done' },
      { kind: 'progress', progressText: 'Capturing 2 of 2: beta...' },
    );
    expect(state).toEqual({ kind: 'result', reportText: 'done' });
  });

  it('cancelled from running (nothing to cancel mid-run) changes nothing', () => {
    const state = reduceEndDayPanel({ kind: 'running', progressText: null }, { kind: 'cancelled' });
    expect(state).toEqual({ kind: 'running', progressText: null });
  });

  it('closed from idle stays idle (no dialog to dismiss)', () => {
    const state = reduceEndDayPanel({ kind: 'idle' }, { kind: 'closed' });
    expect(state).toEqual({ kind: 'idle' });
  });

  it('closed from running dismisses it too — never a stray dialog stuck open', () => {
    const state = reduceEndDayPanel(
      { kind: 'running', progressText: 'Capturing 1 of 1: alpha...' },
      { kind: 'closed' },
    );
    expect(state).toEqual({ kind: 'idle' });
  });
});
