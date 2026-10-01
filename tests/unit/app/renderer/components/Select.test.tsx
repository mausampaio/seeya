// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { Select } from '../../../../../packages/app/src/renderer/components/Select/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Select/Select.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

describe('Select (D-052, V2-T66)', () => {
  it('renders the label and one option per entry', () => {
    const { getByLabelText, getByText } = render(
      <Select id="my-select" label="Resume in" value="a" options={OPTIONS} />,
    );
    const select = getByLabelText('Resume in') as HTMLSelectElement;
    expect(select.value).toBe('a');
    expect(getByText('Option A')).not.toBeNull();
    expect(getByText('Option B')).not.toBeNull();
  });

  it('calls onChange with the newly chosen value', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <Select id="my-select" label="Resume in" value="a" options={OPTIONS} onChange={onChange} />,
    );
    fireEvent.change(getByLabelText('Resume in'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('disabled: the select refuses interaction', () => {
    const { getByLabelText } = render(
      <Select id="my-select" label="Resume in" value="a" options={OPTIONS} disabled />,
    );
    expect((getByLabelText('Resume in') as HTMLSelectElement).disabled).toBe(true);
  });

  it('monospace is opt-in — absent by default', () => {
    const { getByLabelText } = render(
      <Select id="my-select" label="Resume in" value="a" options={OPTIONS} />,
    );
    expect(classesOf(getByLabelText('Resume in'))).not.toContain(styles.monospace);
  });

  it('applies the monospace class when asked (paths read better in mono)', () => {
    const { getByLabelText } = render(
      <Select id="my-select" label="Resume in" value="a" options={OPTIONS} monospace />,
    );
    expect(classesOf(getByLabelText('Resume in'))).toContain(styles.monospace);
  });
});
