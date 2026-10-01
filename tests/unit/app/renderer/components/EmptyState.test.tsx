// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { EmptyState } from '../../../../../packages/app/src/renderer/components/EmptyState/index.js';

afterEach(cleanup);

describe('EmptyState (D-052, V2-T66)', () => {
  it('renders the title, with no description/action when omitted', () => {
    const { getByText, queryByRole } = render(<EmptyState title="Nothing to resume" />);
    expect(getByText('Nothing to resume')).not.toBeNull();
    expect(queryByRole('button')).toBeNull();
  });

  it('renders the description only when given', () => {
    const { getByText } = render(
      <EmptyState title="Nothing to resume" description="Everything is already open." />,
    );
    expect(getByText('Everything is already open.')).not.toBeNull();
  });

  it('renders the action slot only when given, without knowing what it is', () => {
    const { getByRole } = render(
      <EmptyState title="No projects yet" action={<button type="button">New project</button>} />,
    );
    expect(getByRole('button', { name: 'New project' })).not.toBeNull();
  });
});
