import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { Checkbox } from '../../../../packages/app/src/ui/checkbox.js';
import { propsOf } from './_vnode.js';

interface LabelProps {
  readonly for: string;
  readonly children: readonly [VNode<unknown>, unknown];
}
interface InputProps {
  readonly type: string;
  readonly checked: boolean;
  readonly value?: string;
  readonly onChange?: (event: unknown) => void;
}

describe('Checkbox (V2-T62, D-051)', () => {
  it('renders a labeled checkbox input carrying checked/value', () => {
    const vnode = Checkbox({ id: 's1', label: 'my-project', checked: true, value: 'session-1' });
    expect(vnode.type).toBe('label');
    const labelProps = propsOf<LabelProps>(vnode);
    expect(labelProps.for).toBe('s1');
    const [input] = labelProps.children;
    const inputProps = propsOf<InputProps>(input);
    expect(inputProps.type).toBe('checkbox');
    expect(inputProps.checked).toBe(true);
    expect(inputProps.value).toBe('session-1');
  });

  it('calls onChange with the new checked state', () => {
    let received: boolean | undefined;
    const vnode = Checkbox({
      id: 's1',
      label: 'x',
      checked: false,
      onChange: (v) => (received = v),
    });
    const [input] = propsOf<LabelProps>(vnode).children;
    propsOf<InputProps>(input).onChange?.({ target: { checked: true } });
    expect(received).toBe(true);
  });
});
