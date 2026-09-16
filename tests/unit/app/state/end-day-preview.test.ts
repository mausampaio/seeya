import { describe, expect, it } from 'vitest';
import { buildEndDayCostCeiling } from '../../../../packages/app/src/state/end-day-preview.js';

describe('buildEndDayCostCeiling', () => {
  it('carries sessionsInScope/budgetPerSessionUsd/captureModel through unchanged', () => {
    const ceiling = buildEndDayCostCeiling(3, {
      budgetPerSessionUsd: 0.5,
      captureModel: 'claude-3-5-sonnet',
    });

    expect(ceiling.sessionsInScope).toBe(3);
    expect(ceiling.budgetPerSessionUsd).toBe(0.5);
    expect(ceiling.captureModel).toBe('claude-3-5-sonnet');
  });

  it('totalCeilingUsd is sessionsInScope * budgetPerSessionUsd', () => {
    const ceiling = buildEndDayCostCeiling(4, {
      budgetPerSessionUsd: 0.25,
      captureModel: 'claude-3-5-sonnet',
    });

    expect(ceiling.totalCeilingUsd).toBe(1);
  });

  it('zero sessions in scope is a real, honest zero ceiling — never omitted (D-025)', () => {
    const ceiling = buildEndDayCostCeiling(0, {
      budgetPerSessionUsd: 2,
      captureModel: 'claude-3-5-sonnet',
    });

    expect(ceiling.totalCeilingUsd).toBe(0);
  });
});
