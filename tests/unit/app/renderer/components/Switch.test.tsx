// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { Switch } from '../../../../../packages/app/src/renderer/components/Switch/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Switch/Switch.module.css';

afterEach(cleanup);

describe('Switch (V2-T62, D-051; CSS module + render tests since V2-T65)', () => {
  it('renders a checkbox input with role="switch", labelled by the given text', () => {
    const { getByLabelText } = render(
      <Switch id="autostart" label="Start with the system" checked={false} />,
    );
    const input = getByLabelText('Start with the system') as HTMLInputElement;
    expect(input.type).toBe('checkbox');
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.checked).toBe(false);
  });

  it('calls onChange with the new checked state', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <Switch id="autostart" label="X" checked={true} onChange={onChange} />,
    );
    fireEvent.click(getByLabelText('X'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('disables the input when asked, and never shows a reason while enabled', () => {
    const { getByLabelText, container } = render(
      <Switch id="x" label="X" checked={false} disabledReason="should never show" />,
    );
    expect((getByLabelText('X') as HTMLInputElement).disabled).toBe(false);
    expect(container.querySelector(`.${styles.reason}`)).toBeNull();
  });

  it('shows disabledReason only while disabled (docs/INTERFACE.md § 8)', () => {
    const { getByText, getByLabelText } = render(
      <Switch id="x" label="X" checked={false} disabled disabledReason="Managed by the CLI." />,
    );
    expect((getByLabelText('X') as HTMLInputElement).disabled).toBe(true);
    expect(getByText('Managed by the CLI.')).not.toBeNull();
  });

  describe('loading (D-052, maintainer complement, V2-T65-estado-na-tela item 2)', () => {
    it('omitted: no spinner slot, not disabled, no aria-busy', () => {
      const { getByLabelText, container } = render(<Switch id="x" label="X" checked={false} />);
      expect((getByLabelText('X') as HTMLInputElement).disabled).toBe(false);
      expect(container.querySelector('[aria-busy]')).toBeNull();
      expect(container.querySelector('svg')).toBeNull();
    });

    it('true: disables the input, sets aria-busy on the row, shows a spinner, hides disabledReason', () => {
      const { getByLabelText, container, queryByText } = render(
        <Switch
          id="x"
          label="X"
          checked={false}
          loading
          disabledReason="should never show while loading"
        />,
      );
      expect((getByLabelText('X') as HTMLInputElement).disabled).toBe(true);
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(container.querySelector('svg')).not.toBeNull();
      expect(queryByText('should never show while loading')).toBeNull();
    });

    it('a change handler never fires while loading (the input is disabled)', () => {
      const onChange = vi.fn();
      const { getByLabelText } = render(
        <Switch id="x" label="X" checked={false} loading onChange={onChange} />,
      );
      fireEvent.click(getByLabelText('X'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('the spinner node is the SAME across the loading transition — only visibility toggles', () => {
      const { container, rerender } = render(
        <Switch id="x" label="X" checked={false} loading={false} />,
      );
      const spinnerBefore = container.querySelector('svg');
      expect(spinnerBefore).not.toBeNull();
      rerender(<Switch id="x" label="X" checked={false} loading />);
      expect(container.querySelector('svg')).toBe(spinnerBefore);
    });
  });
});
