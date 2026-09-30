import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { Select } from '../../../../packages/app/src/ui/select.js';
import { propsOf } from './_vnode.js';

interface DivProps {
  readonly children: readonly [VNode<unknown>, VNode<unknown>];
}
interface SelectProps {
  readonly value: string;
  readonly children: readonly VNode<unknown>[];
  readonly onChange?: (event: unknown) => void;
}
interface OptionProps {
  readonly value: string;
}

describe('Select (V2-T62, D-051)', () => {
  const options = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
  ];

  it('renders one option per entry, in order', () => {
    const vnode = Select({ id: 'theme', label: 'Theme', value: 'system', options });
    const [, select] = propsOf<DivProps>(vnode).children;
    const renderedOptions = propsOf<SelectProps>(select).children;
    expect(renderedOptions).toHaveLength(2);
    expect(propsOf<OptionProps>(renderedOptions[0] as VNode<unknown>).value).toBe('system');
    expect(propsOf<OptionProps>(renderedOptions[1] as VNode<unknown>).value).toBe('light');
  });

  it('sets the select value and forwards onChange', () => {
    let received: string | undefined;
    const vnode = Select({
      id: 'theme',
      label: 'Theme',
      value: 'light',
      options,
      onChange: (v) => (received = v),
    });
    const [, select] = propsOf<DivProps>(vnode).children;
    const selectProps = propsOf<SelectProps>(select);
    expect(selectProps.value).toBe('light');
    selectProps.onChange?.({ target: { value: 'dark' } });
    expect(received).toBe('dark');
  });
});
