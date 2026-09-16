import { describe, expect, it } from 'vitest';
import { projectEndDayProgressEvent } from '../../../../packages/app/src/state/end-day-progress.js';
import type { CaptureProgressEvent } from '@seeya-ai/engine/application/types.js';

const SESSION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  cwd: '/projects/alpha',
  name: 'alpha',
};

describe('projectEndDayProgressEvent', () => {
  it('captureStarted projects to index/total/name', () => {
    const event: CaptureProgressEvent = {
      kind: 'captureStarted',
      session: SESSION,
      index: 2,
      total: 5,
    };

    expect(projectEndDayProgressEvent(event)).toEqual({ index: 2, total: 5, name: 'alpha' });
  });

  it('captureFinished projects to null — the panel only shows what is CURRENTLY running', () => {
    const captured: CaptureProgressEvent = {
      kind: 'captureFinished',
      session: SESSION,
      index: 2,
      total: 5,
      outcome: { kind: 'captured' },
    };
    const failed: CaptureProgressEvent = {
      kind: 'captureFinished',
      session: SESSION,
      index: 3,
      total: 5,
      outcome: { kind: 'failed', reason: 'claude binary not found' },
    };

    expect(projectEndDayProgressEvent(captured)).toBeNull();
    expect(projectEndDayProgressEvent(failed)).toBeNull();
  });
});
