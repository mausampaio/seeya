// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { StatusList } from '../../../../../packages/app/src/renderer/components/StatusList/index.js';

afterEach(cleanup);

describe('StatusList (D-052, V2-T69)', () => {
  it('renders the empty message when there are no items', () => {
    const { getByText, queryByRole } = render(
      <StatusList items={[]} emptyMessage="Nothing to show." />,
    );
    expect(getByText('Nothing to show.')).not.toBeNull();
    expect(queryByRole('list')).toBeNull();
  });

  it('renders one row per item, with title, meta and detail', () => {
    const { getByText } = render(
      <StatusList
        items={[
          {
            id: 's1',
            title: 'alpha',
            meta: '~/code/alpha',
            detail: 'No activity within the relevance window.',
          },
        ]}
        emptyMessage="Nothing to show."
      />,
    );
    expect(getByText('alpha')).not.toBeNull();
    expect(getByText('~/code/alpha')).not.toBeNull();
    expect(getByText('No activity within the relevance window.')).not.toBeNull();
  });

  it('renders every badge as visible text, never colour alone (identity § 8)', () => {
    const { getByText } = render(
      <StatusList
        items={[
          {
            id: 's1',
            title: 'alpha',
            badges: [
              { label: 'ended', tone: 'neutral' },
              { label: 'lean', tone: 'neutral' },
            ],
          },
        ]}
        emptyMessage="x"
      />,
    );
    expect(getByText('ended')).not.toBeNull();
    expect(getByText('lean')).not.toBeNull();
  });

  it('renders an item with neither meta, detail nor badges without error', () => {
    const { getByText } = render(
      <StatusList items={[{ id: 's1', title: 'alpha' }]} emptyMessage="x" />,
    );
    expect(getByText('alpha')).not.toBeNull();
  });

  it('renders one li per item, in order', () => {
    const { container } = render(
      <StatusList
        items={[
          { id: 's1', title: 'alpha' },
          { id: 's2', title: 'beta' },
        ]}
        emptyMessage="x"
      />,
    );
    const titles = Array.from(container.querySelectorAll('li')).map((li) => li.textContent);
    expect(titles).toEqual(['alpha', 'beta']);
  });
});
