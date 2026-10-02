// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { SessionsHeader } from '../../../../../../packages/app/src/renderer/features/sessions/SessionsHeader/index.js';

afterEach(cleanup);

describe('SessionsHeader (V2-T68)', () => {
  it('shows the title, the total count, and the running count', () => {
    const { getByText } = render(<SessionsHeader totalCount={12} runningCount={3} />);
    expect(getByText('Sessions')).not.toBeNull();
    expect(getByText('12 sessions')).not.toBeNull();
    expect(getByText('· 3 running')).not.toBeNull();
  });

  it('singularizes the total count for exactly one session', () => {
    const { getByText } = render(<SessionsHeader totalCount={1} runningCount={0} />);
    expect(getByText('1 session')).not.toBeNull();
    expect(getByText('· 0 running')).not.toBeNull();
  });
});
