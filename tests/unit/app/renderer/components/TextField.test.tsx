// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { TextField } from '../../../../../packages/app/src/renderer/components/TextField/index.js';
import styles from '../../../../../packages/app/src/renderer/components/TextField/TextField.module.css';

afterEach(cleanup);

describe('TextField (V2-T62, D-051; CSS module + render tests since V2-T64)', () => {
  it('renders a label wrapping an input with the given id/value', () => {
    const { getByLabelText } = render(
      <TextField id="new-project-id-input" label="Project id" value="auth" />,
    );
    const input = getByLabelText('Project id') as HTMLInputElement;
    expect(input.id).toBe('new-project-id-input');
    expect(input.value).toBe('auth');
    expect(input.type).toBe('text');
  });

  it('omits the hint/error paragraphs when not given', () => {
    const { container } = render(<TextField id="x" label="X" value="" />);
    expect(container.querySelector(`.${styles.hint}`)).toBeNull();
    expect(container.querySelector(`.${styles.error}`)).toBeNull();
  });

  it('renders the hint/error paragraphs when given', () => {
    const { getByText } = render(
      <TextField id="x" label="X" value="" hint="terminalFontSize" error="bad" />,
    );
    expect(getByText('terminalFontSize')).not.toBeNull();
    expect(getByText('bad')).not.toBeNull();
  });

  it('calls onInput with the new value', () => {
    const onInput = vi.fn();
    const { getByLabelText } = render(
      <TextField id="x" label="X" value="" onInput={onInput} />,
    );
    fireEvent.input(getByLabelText('X'), { target: { value: 'typed' } });
    expect(onInput).toHaveBeenCalledWith('typed');
  });

  it('disables the input when asked', () => {
    const { getByLabelText } = render(
      <TextField id="x" label="X" value="" disabled />,
    );
    expect((getByLabelText('X') as HTMLInputElement).disabled).toBe(true);
  });
});
