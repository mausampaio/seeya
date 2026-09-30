import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { TextField } from '../../../../../packages/app/src/renderer/components/TextField/TextField.js';
import { propsOf } from './_vnode.js';

interface DivProps {
  readonly children: readonly (VNode<unknown> | false)[];
}
interface LabelProps {
  readonly for: string;
}
interface InputProps {
  readonly id: string;
  readonly value: string;
  readonly type: string;
  readonly onInput?: (event: unknown) => void;
}

describe('TextField (V2-T62, D-051)', () => {
  it('renders a label wrapping an input with the given id/value', () => {
    const vnode = TextField({ id: 'new-project-id-input', label: 'Project id', value: 'auth' });
    const [label, input] = propsOf<DivProps>(vnode).children as [VNode<unknown>, VNode<unknown>];
    expect(propsOf<LabelProps>(label).for).toBe('new-project-id-input');
    const inputProps = propsOf<InputProps>(input);
    expect(inputProps.id).toBe('new-project-id-input');
    expect(inputProps.value).toBe('auth');
    expect(inputProps.type).toBe('text');
  });

  it('omits the hint/error paragraphs when not given', () => {
    const vnode = TextField({ id: 'x', label: 'X', value: '' });
    const children = propsOf<DivProps>(vnode).children.filter(Boolean);
    // label + input only — the two optional paragraphs render as `false`, which Preact skips.
    expect(children).toHaveLength(2);
  });

  it('renders the hint/error paragraphs when given', () => {
    const vnode = TextField({
      id: 'x',
      label: 'X',
      value: '',
      hint: 'terminalFontSize',
      error: 'bad',
    });
    const children = propsOf<DivProps>(vnode).children.filter(Boolean);
    expect(children).toHaveLength(4);
  });

  it('calls onInput with the new value', () => {
    let received: string | undefined;
    const vnode = TextField({ id: 'x', label: 'X', value: '', onInput: (v) => (received = v) });
    const [, input] = propsOf<DivProps>(vnode).children as [VNode<unknown>, VNode<unknown>];
    propsOf<InputProps>(input).onInput?.({ target: { value: 'typed' } });
    expect(received).toBe('typed');
  });
});
