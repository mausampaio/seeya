// @vitest-environment happy-dom
import { useRef } from 'preact/hooks';
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

  it('forwards an optional native tooltip (V2-T83), absent otherwise', () => {
    const withTitle = render(
      <IconButton aria-label="Manage project X" title="Manage project X">
        <span>i</span>
      </IconButton>,
    );
    expect(withTitle.getByRole('button').getAttribute('title')).toBe('Manage project X');
    cleanup();
    const without = render(
      <IconButton aria-label="Manage project X">
        <span>i</span>
      </IconButton>,
    );
    expect(without.getByRole('button').hasAttribute('title')).toBe(false);
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

  it('exposes the underlying node via buttonRef (V2-T64 — Popover anchor positioning)', () => {
    let captured: HTMLButtonElement | null = null;
    function Harness() {
      const buttonRef = useRef<HTMLButtonElement>(null);
      captured = buttonRef.current;
      return (
        <IconButton aria-label="+" buttonRef={buttonRef}>
          +
        </IconButton>
      );
    }
    const { getByRole, rerender } = render(<Harness />);
    // The ref is only populated AFTER the DOM commit — re-render once to read it back, same
    // "measure after mount" shape `Popover.tsx#positionNear` itself relies on.
    rerender(<Harness />);
    expect(captured).toBe(getByRole('button'));
  });

  describe('loading (D-052, maintainer complement, V2-T65-estado-na-tela item 2)', () => {
    it('omitted: renders the icon normally, not disabled, no aria-busy', () => {
      const { getByRole } = render(
        <IconButton aria-label="Start daemon">
          <span data-testid="icon" />
        </IconButton>,
      );
      const button = getByRole('button') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-busy')).toBeNull();
      expect(button.querySelector('[data-testid="icon"]')).not.toBeNull();
    });

    it('true: replaces the icon with a Spinner, in the SAME fixed-size box — disables, aria-busy', () => {
      const { getByRole, container } = render(
        <IconButton aria-label="Start daemon" loading>
          <span data-testid="icon" />
        </IconButton>,
      );
      const button = getByRole('button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
      // The icon is gone WHILE loading (IconButton's own box size, unlike Button, never changes —
      // `size` already fixes `width`/`height` in CSS regardless of what's inside).
      expect(button.querySelector('[data-testid="icon"]')).toBeNull();
      expect(container.querySelector('svg')).not.toBeNull();
    });

    it('a click handler never fires while loading', () => {
      const onClick = vi.fn();
      const { getByRole } = render(
        <IconButton aria-label="x" loading onClick={onClick}>
          i
        </IconButton>,
      );
      fireEvent.click(getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('still applies the same size class while loading — the box itself never resizes', () => {
      const { getByRole } = render(
        <IconButton aria-label="x" size="sm" loading>
          i
        </IconButton>,
      );
      expect(classesOf(getByRole('button'))).toContain(styles.sm);
    });
  });
});
