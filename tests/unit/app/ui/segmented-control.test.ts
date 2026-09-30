import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { SegmentedControl } from '../../../../packages/app/src/ui/segmented-control.js';
import { propsOf } from './_vnode.js';

interface GroupProps {
  readonly role: string;
  readonly 'aria-label': string;
  readonly children: readonly VNode<unknown>[];
}
interface OptionButtonProps {
  readonly 'aria-pressed': boolean;
  readonly onClick: () => void;
}

describe('SegmentedControl (V2-T62, D-051)', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'running', label: 'Running' },
  ];

  it('renders one button per option, marking the current value as pressed', () => {
    const vnode = SegmentedControl({ ariaLabel: 'Filter', value: 'running', options });
    const groupProps = propsOf<GroupProps>(vnode);
    expect(groupProps.role).toBe('radiogroup');
    expect(groupProps['aria-label']).toBe('Filter');
    const buttons = groupProps.children;
    expect(buttons).toHaveLength(2);
    expect(propsOf<OptionButtonProps>(buttons[0] as VNode<unknown>)['aria-pressed']).toBe(false);
    expect(propsOf<OptionButtonProps>(buttons[1] as VNode<unknown>)['aria-pressed']).toBe(true);
  });

  it('calls onChange with the clicked option value', () => {
    let received: string | undefined;
    const vnode = SegmentedControl({
      ariaLabel: 'Filter',
      value: 'all',
      options,
      onChange: (v) => (received = v),
    });
    const buttons = propsOf<GroupProps>(vnode).children;
    propsOf<OptionButtonProps>(buttons[1] as VNode<unknown>).onClick();
    expect(received).toBe('running');
  });
});
