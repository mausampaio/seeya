// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import type { JSX } from 'preact';
import { TableRow } from '../../../../../packages/app/src/renderer/components/TableRow/index.js';

afterEach(cleanup);

function renderInTable(ui: JSX.Element) {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );
}

describe('TableRow (D-052, V2-T67)', () => {
  it('renders one cell per entry, in order', () => {
    const { container } = renderInTable(<TableRow cells={['a', 'b', 'c']} />);
    const cells = container.querySelectorAll('td');
    expect(Array.from(cells).map((cell) => cell.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('calls onClick when the row is clicked, and never without one', () => {
    const onClick = vi.fn();
    const { getByText } = renderInTable(<TableRow cells={['name']} onClick={onClick} />);
    fireEvent.click(getByText('name'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('never throws clicking a row with no onClick', () => {
    const { getByText } = renderInTable(<TableRow cells={['name']} />);
    expect(() => fireEvent.click(getByText('name'))).not.toThrow();
  });
});
