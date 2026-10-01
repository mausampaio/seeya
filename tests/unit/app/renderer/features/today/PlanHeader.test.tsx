// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { PlanHeader } from '../../../../../../packages/app/src/renderer/features/today/PlanHeader/index.js';

afterEach(cleanup);

describe('PlanHeader (D-052, V2-T66)', () => {
  it('shows the plan title and the context line with a captured instant and session count', () => {
    const { getByText } = render(
      <PlanHeader
        day="2026-09-30"
        daysAgo={1}
        capturedAt={new Date('2026-09-30T21:00:00.000Z')}
        sessionCount={3}
      />,
    );
    expect(getByText('Plan for 2026-09-30')).not.toBeNull();
    expect(getByText(/3 sessions/)).not.toBeNull();
    expect(getByText(/Captured/)).not.toBeNull();
  });

  it('shows "(N days ago)" in the title when daysAgo is not 1', () => {
    const { getByText } = render(
      <PlanHeader day="2026-09-20" daysAgo={10} capturedAt={null} sessionCount={1} />,
    );
    expect(getByText('Plan for 2026-09-20 (10 days ago)')).not.toBeNull();
  });

  it('context line never mentions "Captured" when capturedAt is null (D-025)', () => {
    const { getByText, queryByText } = render(
      <PlanHeader day="2026-09-30" daysAgo={1} capturedAt={null} sessionCount={1} />,
    );
    expect(queryByText(/Captured/)).toBeNull();
    expect(getByText('1 session')).not.toBeNull();
  });
});
