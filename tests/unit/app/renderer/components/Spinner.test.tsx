// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Spinner } from '../../../../../packages/app/src/renderer/components/Spinner/index.js';

afterEach(cleanup);

describe('Spinner (D-052, V2-T65-estado-na-tela)', () => {
  it('draws an outline arc on the 24-unit grid, hidden from assistive tech', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to 16px, overridable by size', () => {
    const small = render(<Spinner />).container.querySelector('svg');
    expect(small?.getAttribute('width')).toBe('16');
    cleanup();
    const large = render(<Spinner size={24} />).container.querySelector('svg');
    expect(large?.getAttribute('width')).toBe('24');
  });
});
