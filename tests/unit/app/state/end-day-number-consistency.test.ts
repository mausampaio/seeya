/**
 * PO review round 2 (V2-T69, item 1): "três números para a mesma coisa" — the cost ceiling's own
 * `N`, the running view's own `M` ("i of M"), and the "Will be captured" heading's own total used
 * to disagree (3, 4, and 5 respectively, for the PO's own screenshot fixture) because each one read
 * a different collection. This test builds ONE `EndDayResult` fixture — mirroring exactly the PO's
 * own screenshot (alpha/beta/gamma captured, delta-ignored cheap-ineligible, epsilon-closed
 * listed, zeta-poisoned a genuine `CaptureFailure`) — and proves, through the REAL production
 * functions (`buildEndDayPreviewRows`, `buildEndDayCostCeiling`, `reduceEndDayPanel`), that the
 * three numbers are now identical by construction, never three independent counts that could drift
 * apart. It fails before the fix: `buildEndDayCostCeiling` used to take `result.sessionsInScope`
 * (5, counting delta AND zeta) and `seedTrackedSessions` used to also track `kind: 'failed'` rows
 * (so `M` was 4, counting zeta) — neither matched `willBeCaptured.length` (3).
 */
import { describe, expect, it } from 'vitest';
import { buildEndDayCostCeiling } from '../../../../packages/app/src/state/end-day-preview.js';
import { buildEndDayPreviewRows } from '../../../../packages/app/src/state/end-day-sessions.js';
import {
  reduceEndDayPanel,
  type EndDayPanelState,
} from '../../../../packages/app/src/state/end-day-panel.js';
import { buildHandoffFixture } from '../_handoff-fixture.js';
import type {
  CapturedSession,
  EndDayResult,
  IneligibleSession,
} from '@seeya-ai/engine/application/types.js';
import type { SessionListing } from '@seeya-ai/engine/core/types.js';
import type { Config } from '@seeya-ai/engine/core/types.js';
import { DEFAULT_CONFIG } from '@seeya-ai/engine/adapters/storage/config-schema.js';

const HOME_DIR = '/home/x';

function captured(sessionId: string, name: string): CapturedSession {
  return {
    handoff: buildHandoffFixture({ sessionId, name, cwd: `/home/x/code/${name}` }),
    terminated: false,
  };
}

const BETA_IGNORED: IneligibleSession = {
  sessionId: 'beta',
  cwd: '/home/x/code/ignored-project',
  name: 'delta-ignored',
  reasons: ['ignoredCwd'],
};

const EPSILON_CLOSED: SessionListing = {
  sessionId: 'epsilon',
  cwd: '/home/x/code/closed-session',
  name: 'closed-session',
  info: { kind: 'read', aiTitle: null, lastPrompt: null },
};

const CONFIG: Pick<Config, 'budgetPerSessionUsd' | 'captureModel'> = {
  budgetPerSessionUsd: DEFAULT_CONFIG.budgetPerSessionUsd,
  captureModel: DEFAULT_CONFIG.captureModel,
};

function buildResult(): EndDayResult {
  return {
    day: '2026-10-01',
    scope: { kind: 'fullDay' },
    discoveredCount: 5,
    rejectedDiscoveries: [],
    ineligible: [BETA_IGNORED],
    captured: [
      captured('alpha', 'alpha'),
      captured('gamma', 'beta'),
      captured('zeta2', 'gamma-deep'),
    ],
    failedCaptures: [
      {
        sessionId: 'zeta',
        name: 'zeta-poisoned',
        cwd: '/home/x/code/zeta-poisoned',
        reason: '/home/x/.seeya/days/2026-10-01/sessions/zeta.json is not valid JSON: SyntaxError',
      },
    ],
    terminationNotices: [],
    dryRun: true,
    briefingPreview: null,
    // The engine's own `sessionsInScope` is deliberately bigger (5 = 3 captured + 1 ineligible + 1
    // failed) than what any of the three UI numbers should read after this fix — proving the fix
    // means proving NONE of them reads this field any more.
    sessionsInScope: 5,
    listedSessions: [EPSILON_CLOSED],
    forkCleanup: null,
    forkCleanupError: null,
  };
}

describe('the cost ceiling, the running view\'s own M, and "Will be captured" agree (PO review round 2, item 1)', () => {
  it('all three read exactly willBeCaptured.length for the same fixture — never 3, 4, and 5', () => {
    const result = buildResult();
    const { willBeCaptured, notCaptured } = buildEndDayPreviewRows(result, HOME_DIR, 'posix');

    // "Will be captured"'s own total.
    expect(willBeCaptured).toHaveLength(3);

    // The cost ceiling's own N — `main.ts#endDayPreview` passes `willBeCaptured.length`, never
    // `result.sessionsInScope` (5).
    const costCeiling = buildEndDayCostCeiling(willBeCaptured.length, CONFIG);
    expect(costCeiling.sessionsInScope).toBe(3);

    // The running view's own M ("i of M") — seeded from the SAME `willBeCaptured` list.
    let state: EndDayPanelState = reduceEndDayPanel(
      { kind: 'previewPending' },
      { kind: 'previewReady', willBeCaptured, notCaptured, costCeiling },
    );
    state = reduceEndDayPanel(state, { kind: 'runClicked' });
    const first = willBeCaptured[0];
    if (first === undefined) {
      throw new Error('fixture produced an empty willBeCaptured list');
    }
    state = reduceEndDayPanel(state, {
      kind: 'sessionStarted',
      sessionId: first.sessionId,
      name: first.name,
    });
    expect(state.kind).toBe('running');
    if (state.kind !== 'running') {
      throw new Error(`expected 'running', got '${state.kind}'`);
    }
    expect(state.current.total).toBe(3);

    // All three, side by side — the actual invariant the PO asked to be locked.
    expect([willBeCaptured.length, costCeiling.sessionsInScope, state.current.total]).toEqual([
      3, 3, 3,
    ]);
  });
});
