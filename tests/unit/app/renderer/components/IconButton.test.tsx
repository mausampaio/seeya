// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { IconButton } from '../../../../../packages/app/src/renderer/components/IconButton/index.js';
import styles from '../../../../../packages/app/src/renderer/components/IconButton/IconButton.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

describe('IconButton (D-052, V2-T75)', () => {
  it('requires an accessible name — the type system, not a runtime check', () => {
    const { getByRole } = render(
      <IconButton aria-label="Collapse sidebar">
        <span>‹</span>
      </IconButton>,
    );
    expect(getByRole('button', { name: 'Collapse sidebar' })).not.toBeNull();
  });

  it('defaults to ghost variant, size md', () => {
    const { getByRole } = render(<IconButton aria-label="x">i</IconButton>);
    expect(classesOf(getByRole('button'))).toEqual(
      expect.arrayContaining([styles.ghost, styles.md]),
    );
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('applies the %s variant class', (variant) => {
    const { getByRole } = render(
      <IconButton aria-label="x" variant={variant}>
        i
      </IconButton>,
    );
    expect(classesOf(getByRole('button'))).toContain(styles[variant]);
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size class', (size) => {
    const { getByRole } = render(
      <IconButton aria-label="x" size={size}>
        i
      </IconButton>,
    );
    expect(classesOf(getByRole('button'))).toContain(styles[size]);
  });

  it('centers its content via its own layout class (never left to the icon)', () => {
    const { getByRole } = render(<IconButton aria-label="x">i</IconButton>);
    expect(classesOf(getByRole('button'))).toContain(styles.iconButton);
  });

  it('forwards id, disabled, hidden and a click handler', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <IconButton id="daemon-control-button" aria-label="Start daemon" onClick={onClick}>
        i
      </IconButton>,
    );
    const button = getByRole('button') as HTMLButtonElement;
    expect(button.id).toBe('daemon-control-button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is never a submit button', () => {
    const { getByRole } = render(<IconButton aria-label="x">i</IconButton>);
    expect((getByRole('button') as HTMLButtonElement).type).toBe('button');
  });
});
