// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { Button } from '../../../../../packages/app/src/renderer/components/Button/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Button/Button.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

describe('Button (D-052, V2-T75)', () => {
  it('renders a native button, type="button" and variant="primary"/size="md" by default', () => {
    const { getByRole } = render(<Button>Save</Button>);
    const button = getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(classesOf(button)).toEqual(expect.arrayContaining([styles.primary, styles.md]));
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('applies the %s variant class', (variant) => {
    const { getByRole } = render(<Button variant={variant}>x</Button>);
    expect(classesOf(getByRole('button'))).toContain(styles[variant]);
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size class', (size) => {
    const { getByRole } = render(<Button size={size}>x</Button>);
    expect(classesOf(getByRole('button'))).toContain(styles[size]);
  });

  it('applies the fullWidth class only when asked', () => {
    const withFullWidth = render(<Button fullWidth>x</Button>);
    expect(classesOf(withFullWidth.getByRole('button'))).toContain(styles.fullWidth);
    withFullWidth.unmount();

    const withoutFullWidth = render(<Button>x</Button>);
    expect(classesOf(withoutFullWidth.getByRole('button'))).not.toContain(styles.fullWidth);
  });

  it('renders as type="submit" when asked', () => {
    const { getByRole } = render(<Button type="submit">x</Button>);
    expect((getByRole('button') as HTMLButtonElement).type).toBe('submit');
  });

  it('forwards id, disabled, hidden and a click handler', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button id="end-day-button" disabled hidden onClick={onClick}>
        End day…
      </Button>,
    );
    const button = getByRole('button', { hidden: true }) as HTMLButtonElement;
    expect(button.id).toBe('end-day-button');
    expect(button.disabled).toBe(true);
    expect(button.hidden).toBe(true);
    fireEvent.click(button);
    // A disabled button never dispatches a click at all — this proves `onClick` was WIRED, not
    // that it fires while disabled (browsers already refuse that on their own).
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when enabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges an external className with its own', () => {
    const { getByRole } = render(<Button className="extra">x</Button>);
    expect(classesOf(getByRole('button'))).toContain('extra');
  });

  describe('disabledReason (D-052, V2-T66)', () => {
    it('shown as a sibling line while disabled, NOT loading, with a reason given', () => {
      const { queryByText } = render(
        <Button disabled disabledReason="Select at least one session.">
          Resume selected
        </Button>,
      );
      expect(queryByText('Select at least one session.')).not.toBeNull();
    });

    it('never shown for an ENABLED button', () => {
      const { queryByText } = render(
        <Button disabledReason="Select at least one session.">Resume selected</Button>,
      );
      expect(queryByText('Select at least one session.')).toBeNull();
    });

    it('never shown while loading, even if disabled and a reason is given', () => {
      const { queryByText } = render(
        <Button disabled loading disabledReason="Select at least one session.">
          Resume selected
        </Button>,
      );
      expect(queryByText('Select at least one session.')).toBeNull();
    });
  });

  describe('loading (D-052, maintainer complement, V2-T65-estado-na-tela item 2; overlay fix V2-T79)', () => {
    it('omitted: no spinner in the DOM at all, exactly as before this prop existed', () => {
      const { getByRole, container } = render(<Button>Skip today</Button>);
      expect(container.querySelector('svg')).toBeNull();
      expect(getByRole('button').getAttribute('aria-busy')).toBeNull();
    });

    it(
      'false: structurally IDENTICAL to a button without the prop at all — no spinner, no ' +
        'extra wrapper around the label (V2-T79: this is the case that used to shift Open/Skip ' +
        'today/Create off-center)',
      () => {
        const withLoadingFalse = render(<Button loading={false}>Skip today</Button>);
        const withoutLoading = render(<Button>Skip today</Button>);
        const button = withLoadingFalse.container.querySelector('button');
        if (button === null) {
          throw new Error('expected a <button> in the rendered container, found none');
        }
        expect(button.disabled).toBe(false);
        expect(button.getAttribute('aria-busy')).toBeNull();
        expect(withLoadingFalse.container.querySelector('svg')).toBeNull();
        // Byte-for-byte the same markup either way — the whole point of the fix.
        expect(withLoadingFalse.container.innerHTML).toBe(withoutLoading.container.innerHTML);
        withLoadingFalse.unmount();
        withoutLoading.unmount();
      },
    );

    it(
      'true: disables the button, sets aria-busy, keeps the ORIGINAL label text in the DOM ' +
        '(hidden, never swapped out), and overlays a spinner',
      () => {
        const { getByRole, container } = render(<Button loading>Skip today</Button>);
        const button = getByRole('button') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(button.getAttribute('aria-busy')).toBe('true');
        // The label is still in the DOM (never removed, never replaced by the spinner) — this is
        // what keeps the button's own width stable across the transition.
        expect(button.textContent).toContain('Skip today');
        expect(container.querySelector('svg')).not.toBeNull();
      },
    );

    it('a click handler never fires while loading (same guarantee as plain disabled)', () => {
      const onClick = vi.fn();
      const { getByRole } = render(
        <Button loading onClick={onClick}>
          Skip today
        </Button>,
      );
      fireEvent.click(getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('the spinner is mounted ONLY while loading=true — removed again once it flips back', () => {
      const { container, rerender } = render(<Button loading={false}>x</Button>);
      expect(container.querySelector('svg')).toBeNull();
      rerender(<Button loading>x</Button>);
      expect(container.querySelector('svg')).not.toBeNull();
      rerender(<Button loading={false}>x</Button>);
      expect(container.querySelector('svg')).toBeNull();
    });
  });
});
