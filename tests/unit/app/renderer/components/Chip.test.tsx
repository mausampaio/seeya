// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Chip } from '../../../../../packages/app/src/renderer/components/Chip/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Chip/Chip.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

const TONES = ['neutral', 'brand', 'success', 'info', 'warning', 'error'] as const;
const VARIANTS = ['solid', 'soft', 'outline'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

describe('Chip (D-052, V2-T75)', () => {
  it('always renders visible text (never colour alone)', () => {
    const { getByText } = render(<Chip tone="success">3 running</Chip>);
    expect(getByText('3 running')).not.toBeNull();
  });

  it('defaults to variant="soft", size="md"', () => {
    const { container } = render(<Chip tone="neutral">x</Chip>);
    const classes = classesOf(container.firstElementChild);
    expect(classes).toEqual(expect.arrayContaining([styles.soft, styles.md, styles.neutral]));
  });

  it.each(TONES)('applies the %s tone class', (tone) => {
    const { container } = render(<Chip tone={tone}>x</Chip>);
    expect(classesOf(container.firstElementChild)).toContain(styles[tone]);
  });

  it.each(VARIANTS)('applies the %s variant class', (variant) => {
    const { container } = render(
      <Chip tone="neutral" variant={variant}>
        x
      </Chip>,
    );
    expect(classesOf(container.firstElementChild)).toContain(styles[variant]);
  });

  it.each(SIZES)('applies the %s size class', (size) => {
    const { container } = render(
      <Chip tone="neutral" size={size}>
        x
      </Chip>,
    );
    expect(classesOf(container.firstElementChild)).toContain(styles[size]);
  });

  it('always centers its content via its own layout class', () => {
    const { container } = render(<Chip tone="neutral">x</Chip>);
    expect(classesOf(container.firstElementChild)).toContain(styles.chip);
  });

  it('merges an external className', () => {
    const { container } = render(
      <Chip tone="neutral" className="extra">
        x
      </Chip>,
    );
    expect(classesOf(container.firstElementChild)).toContain('extra');
  });
});
