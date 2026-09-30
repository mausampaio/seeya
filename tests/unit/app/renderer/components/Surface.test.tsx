// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Surface } from '../../../../../packages/app/src/renderer/components/Surface/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Surface/Surface.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

describe('Surface (D-052, V2-T75)', () => {
  it('defaults to variant="default", bordered, no padding/radius/elevation', () => {
    const { container } = render(<Surface>x</Surface>);
    const root = container.firstElementChild as HTMLElement;
    expect(classesOf(root)).toEqual(expect.arrayContaining([styles.default, styles.bordered]));
    // happy-dom's CSSStyleDeclaration normalizes a bare "0" length to "0px" on read-back — the
    // component itself sets the literal "0" (`Surface.tsx`'s own `spaceValue('none')`); this
    // assertion is about what the BROWSER'S OWN style object reports, not a second encoding this
    // component invented.
    expect(root.style.padding).toBe('0px');
    expect(root.style.borderRadius).toBe('0px');
    expect(root.style.boxShadow).toBe('none');
  });

  it.each(['default', 'subtle', 'elevated'] as const)('applies the %s variant class', (variant) => {
    const { container } = render(<Surface variant={variant}>x</Surface>);
    expect(classesOf(container.firstElementChild)).toContain(styles[variant]);
  });

  it('drops the border only when asked', () => {
    const { container } = render(<Surface bordered={false}>x</Surface>);
    expect(classesOf(container.firstElementChild)).not.toContain(styles.bordered);
  });

  it('translates padding/radius/elevation tokens into inline styles', () => {
    const { container } = render(
      <Surface padding="md" radius="lg" elevation="popover">
        x
      </Surface>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.padding).toBe('var(--seeya-space-4)');
    expect(root.style.borderRadius).toBe('var(--seeya-radius-lg)');
    expect(root.style.boxShadow).toBe('var(--seeya-shadow-popover)');
  });

  it('forwards id, className and children', () => {
    const { getByText, container } = render(
      <Surface id="today-card" className="extra">
        <span>Today</span>
      </Surface>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.id).toBe('today-card');
    expect(classesOf(root)).toContain('extra');
    expect(getByText('Today')).not.toBeNull();
  });
});
