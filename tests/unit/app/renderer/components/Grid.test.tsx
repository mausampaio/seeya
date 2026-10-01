// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Grid, GridItem } from '../../../../../packages/app/src/renderer/components/Grid/index.js';

afterEach(cleanup);

describe('Grid/GridItem (D-052, V2-T75)', () => {
  it('defaults to a 12-column grid', () => {
    const { container } = render(<Grid>x</Grid>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--seeya-grid-columns')).toBe('12');
  });

  it('accepts an explicit column count', () => {
    const { container } = render(<Grid columns={4}>x</Grid>);
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue('--seeya-grid-columns'),
    ).toBe('4');
  });

  it('applies the gap token', () => {
    const { container } = render(<Grid gap="sm">x</Grid>);
    expect((container.firstElementChild as HTMLElement).style.gap).toBe('var(--seeya-space-2)');
  });

  it('a 12-column grid with two span={6} children divides evenly (the required example)', () => {
    const { getByText } = render(
      <Grid columns={12} gap="md">
        <GridItem span={6}>
          <span>Left</span>
        </GridItem>
        <GridItem span={6}>
          <span>Right</span>
        </GridItem>
      </Grid>,
    );
    const left = getByText('Left').parentElement as HTMLElement;
    const right = getByText('Right').parentElement as HTMLElement;
    expect(left.style.gridColumn).toBe('span 6');
    expect(right.style.gridColumn).toBe('span 6');
  });

  it.each([1, 3, 12] as const)('GridItem accepts span=%d', (span) => {
    const { container } = render(<GridItem span={span}>x</GridItem>);
    expect((container.firstElementChild as HTMLElement).style.gridColumn).toBe(`span ${span}`);
  });

  it('forwards id and className on both Grid and GridItem', () => {
    const { container } = render(
      <Grid id="sidebar-grid" className="extra">
        <GridItem id="cell" span={6} className="extra-cell">
          x
        </GridItem>
      </Grid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.id).toBe('sidebar-grid');
    expect(grid.className).toContain('extra');
    const cell = grid.firstElementChild as HTMLElement;
    expect(cell.id).toBe('cell');
    expect(cell.className).toContain('extra-cell');
  });
});
