// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Section } from '../../../../../packages/app/src/renderer/components/Section/index.js';

afterEach(cleanup);

describe('Section (D-052, V2-T75)', () => {
  it('renders the title as a heading', () => {
    const { getByRole } = render(<Section title="Favorites" />);
    expect(getByRole('heading', { name: 'Favorites' })).not.toBeNull();
  });

  it('renders an optional action next to the title', () => {
    const { getByRole } = render(
      <Section title="Favorites" action={<button type="button">New project</button>} />,
    );
    expect(getByRole('button', { name: 'New project' })).not.toBeNull();
  });

  it('renders no action when none is given', () => {
    const { queryByRole } = render(<Section title="Recent" />);
    expect(queryByRole('button')).toBeNull();
  });

  it('renders its children in the body', () => {
    const { getByText } = render(
      <Section title="Recent">
        <p>Nothing recent yet.</p>
      </Section>,
    );
    expect(getByText('Nothing recent yet.')).not.toBeNull();
  });

  it('forwards id and an external className', () => {
    const { container } = render(
      <Section id="favorites-section" title="Favorites" className="extra" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.id).toBe('favorites-section');
    expect(root.className).toContain('extra');
  });
});
