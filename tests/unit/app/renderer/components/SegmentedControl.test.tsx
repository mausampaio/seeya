// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SegmentedControl } from '../../../../../packages/app/src/renderer/components/SegmentedControl/index.js';
import styles from '../../../../../packages/app/src/renderer/components/SegmentedControl/SegmentedControl.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
];

describe('SegmentedControl (V2-T62, D-051; CSS module + render tests since V2-T64)', () => {
  it('renders one radio button per option, marking the current value as pressed/checked', () => {
    const { getByRole } = render(
      <SegmentedControl ariaLabel="Filter" value="running" options={OPTIONS} />,
    );
    const group = getByRole('radiogroup', { name: 'Filter' });
    expect(group).not.toBeNull();
    const all = getByRole('radio', { name: 'All' });
    const running = getByRole('radio', { name: 'Running' });
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(running.getAttribute('aria-pressed')).toBe('true');
    expect(classesOf(running)).toContain(styles.selected);
    expect(classesOf(all)).not.toContain(styles.selected);
  });

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <SegmentedControl ariaLabel="Filter" value="all" options={OPTIONS} onChange={onChange} />,
    );
    fireEvent.click(getByRole('radio', { name: 'Running' }));
    expect(onChange).toHaveBeenCalledWith('running');
  });

  it('forwards an option id, for a caller that needs to target one specific segment', () => {
    const { getByRole } = render(
      <SegmentedControl
        ariaLabel="Kind"
        value="shell"
        options={[{ value: 'shell', label: 'Shell', id: 'new-tab-kind-shell' }]}
      />,
    );
    expect(getByRole('radio', { name: 'Shell' }).id).toBe('new-tab-kind-shell');
  });
});
