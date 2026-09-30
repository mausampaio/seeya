import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { Switch } from '../../../../packages/app/src/ui/switch.js';
import { propsOf } from './_vnode.js';

interface LabelProps {
  readonly children: readonly [VNode<unknown>, unknown];
}
interface InputProps {
  readonly type: string;
  readonly role: string;
  readonly checked: boolean;
  readonly onChange?: (event: unknown) => void;
}

describe('Switch (V2-T62, D-051)', () => {
  it('renders a checkbox input with role="switch"', () => {
    const vnode = Switch({ id: 'autostart', label: 'Start with the system', checked: false });
    const [input] = propsOf<LabelProps>(vnode).children;
    const inputProps = propsOf<InputProps>(input);
    expect(inputProps.type).toBe('checkbox');
    expect(inputProps.role).toBe('switch');
    expect(inputProps.checked).toBe(false);
  });

  it('calls onChange with the new checked state', () => {
    let received: boolean | undefined;
    const vnode = Switch({
      id: 'autostart',
      label: 'x',
      checked: true,
      onChange: (v) => (received = v),
    });
    const [input] = propsOf<LabelProps>(vnode).children;
    propsOf<InputProps>(input).onChange?.({ target: { checked: false } });
    expect(received).toBe(false);
  });
});
