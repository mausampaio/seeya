// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { ProgressBar } from '../../../../../packages/app/src/renderer/components/ProgressBar/index.js';

afterEach(cleanup);

describe('ProgressBar (D-052, V2-T69)', () => {
  it('exposes value/max/label through ARIA, for assistive tech', () => {
    const { getByRole } = render(<ProgressBar value={2} max={5} label="Capturing 2 of 5" />);
    const bar = getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-label')).toBe('Capturing 2 of 5');
  });

  it('the fill width is the percentage complete', () => {
    const { getByRole } = render(<ProgressBar value={1} max={4} label="x" />);
    const fill = getByRole('progressbar').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('25%');
  });

  it('zero of zero never divides by zero into NaN% (D-025: an honest 0%, not a crash)', () => {
    const { getByRole } = render(<ProgressBar value={0} max={0} label="x" />);
    const fill = getByRole('progressbar').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('a value above max clamps to 100%, never overflowing the track', () => {
    const { getByRole } = render(<ProgressBar value={9} max={5} label="x" />);
    const fill = getByRole('progressbar').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});
