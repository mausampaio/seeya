// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { InfoBox } from '../../../../../packages/app/src/renderer/components/InfoBox/index.js';
import styles from '../../../../../packages/app/src/renderer/components/InfoBox/InfoBox.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

const TONES = ['neutral', 'brand', 'success', 'info', 'warning', 'error'] as const;

describe('InfoBox (D-052, V2-T66)', () => {
  it('renders its children unwrapped — more than one line of content fits', () => {
    const { getByText } = render(
      <InfoBox>
        <p>first line</p>
        <p>second line</p>
      </InfoBox>,
    );
    expect(getByText('first line')).not.toBeNull();
    expect(getByText('second line')).not.toBeNull();
  });

  it('defaults to tone="neutral"', () => {
    const { container } = render(<InfoBox>x</InfoBox>);
    expect(classesOf(container.firstElementChild)).toContain(styles.neutral);
  });

  it.each(TONES)('applies the %s tone class', (tone) => {
    const { container } = render(<InfoBox tone={tone}>x</InfoBox>);
    expect(classesOf(container.firstElementChild)).toContain(styles[tone]);
  });

  it('merges an external className', () => {
    const { container } = render(<InfoBox className="extra">x</InfoBox>);
    expect(classesOf(container.firstElementChild)).toContain('extra');
  });
});
