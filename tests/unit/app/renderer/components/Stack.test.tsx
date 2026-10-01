// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Stack } from '../../../../../packages/app/src/renderer/components/Stack/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Stack/Stack.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

describe('Stack (D-052, V2-T75)', () => {
  it('stacks children vertically by default', () => {
    const { container } = render(
      <Stack>
        <span>first</span>
        <span>second</span>
      </Stack>,
    );
    const root = container.firstElementChild;
    expect(classesOf(root)).toContain(styles.vertical);
    expect(root?.textContent).toBe('firstsecond');
  });

  it('switches to a horizontal row', () => {
    const { container } = render(<Stack direction="horizontal">x</Stack>);
    expect(classesOf(container.firstElementChild)).toContain(styles.horizontal);
  });

  it('applies the gap token as the flex gap (an inline style, not a class)', () => {
    const { container } = render(<Stack gap="lg">x</Stack>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.gap).toBe('var(--seeya-space-6)');
  });

  it('defaults to no gap', () => {
    const { container } = render(<Stack>x</Stack>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.gap).toBe('0');
  });

  it('applies alignment and justification as classes', () => {
    const { container } = render(
      <Stack align="center" justify="between">
        x
      </Stack>,
    );
    const classes = classesOf(container.firstElementChild);
    expect(classes).toContain(styles.alignCenter);
    expect(classes).toContain(styles.justifyBetween);
  });

  it('wraps only when asked', () => {
    const { container: wrapped } = render(<Stack wrap>x</Stack>);
    expect(classesOf(wrapped.firstElementChild)).toContain(styles.wrap);

    const { container: notWrapped } = render(<Stack>x</Stack>);
    expect(classesOf(notWrapped.firstElementChild)).not.toContain(styles.wrap);
  });

  it('forwards id and an external className', () => {
    const { container } = render(
      <Stack id="sidebar-nav" className="extra">
        x
      </Stack>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.id).toBe('sidebar-nav');
    expect(classesOf(root)).toContain('extra');
  });
});
