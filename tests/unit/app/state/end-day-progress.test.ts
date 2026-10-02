import { describe, expect, it } from 'vitest';
import { projectEndDayProgressEvent } from '../../../../packages/app/src/state/end-day-progress.js';
import type { CaptureProgressEvent } from '@seeya-ai/engine/application/types.js';

const SESSION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  cwd: '/projects/alpha',
  name: 'alpha',
};

describe('projectEndDayProgressEvent (V2-T69)', () => {
  it('captureStarted projects to a started event carrying sessionId/index/total/name', () => {
    const event: CaptureProgressEvent = {
      kind: 'captureStarted',
      session: SESSION,
      index: 2,
      total: 5,
    };

    expect(projectEndDayProgressEvent(event)).toEqual({
      kind: 'started',
      sessionId: SESSION.sessionId,
      name: 'alpha',
      index: 2,
      total: 5,
    });
  });

  it('captureFinished with a captured outcome projects to a finished event', () => {
    const event: CaptureProgressEvent = {
      kind: 'captureFinished',
      session: SESSION,
      index: 2,
      total: 5,
      outcome: { kind: 'captured' },
    };

    expect(projectEndDayProgressEvent(event)).toEqual({
      kind: 'finished',
      sessionId: SESSION.sessionId,
      outcome: 'captured',
    });
  });

  it('captureFinished with a failed outcome carries the outcome kind, not the reason text', () => {
    const event: CaptureProgressEvent = {
      kind: 'captureFinished',
      session: SESSION,
      index: 3,
      total: 5,
      outcome: { kind: 'failed', reason: 'claude binary not found' },
    };

    expect(projectEndDayProgressEvent(event)).toEqual({
      kind: 'finished',
      sessionId: SESSION.sessionId,
      outcome: 'failed',
    });
  });

  it('captureFinished with an ineligible outcome projects to "ineligible"', () => {
    const event: CaptureProgressEvent = {
      kind: 'captureFinished',
      session: SESSION,
      index: 1,
      total: 1,
      outcome: { kind: 'ineligible', reasons: ['duplicateToday'] },
    };

    expect(projectEndDayProgressEvent(event)).toEqual({
      kind: 'finished',
      sessionId: SESSION.sessionId,
      outcome: 'ineligible',
    });
  });
});
