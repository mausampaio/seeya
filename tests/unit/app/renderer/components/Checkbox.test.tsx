// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { Checkbox } from '../../../../../packages/app/src/renderer/components/Checkbox/index.js';

afterEach(cleanup);

describe('Checkbox (D-052, V2-T66)', () => {
  it('renders checked/unchecked from props, never managing its own state', () => {
    const { getByRole, rerender } = render(
      <Checkbox id="session-1" label="alpha" checked={false} />,
    );
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    rerender(<Checkbox id="session-1" label="alpha" checked />);
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('carries value through to the native input (today-panel-view.ts\'s own DOM-read shape)', () => {
    const { getByRole } = render(
      <Checkbox id="session-1" label="alpha" checked={false} value="session-1" />,
    );
    expect((getByRole('checkbox') as HTMLInputElement).value).toBe('session-1');
  });

  it('calls onChange with the new checked value', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Checkbox id="session-1" label="alpha" checked={false} onChange={onChange} />,
    );
    fireEvent.click(getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('clicking anywhere on the label content toggles the box — a multi-line label included', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <Checkbox
        id="session-1"
        checked={false}
        onChange={onChange}
        label={
          <span>
            <span>alpha</span>
            <span>/projects/alpha</span>
          </span>
        }
      />,
    );
    fireEvent.click(getByText('/projects/alpha'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled: the native input refuses the change, onChange never fires', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Checkbox id="session-1" label="alpha" checked={false} disabled onChange={onChange} />,
    );
    expect((getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('merges an external className', () => {
    const { container } = render(
      <Checkbox id="session-1" label="alpha" checked={false} className="extra" />,
    );
    expect(container.firstElementChild?.className).toContain('extra');
  });
});
