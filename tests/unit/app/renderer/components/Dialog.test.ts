import { describe, expect, it } from 'vitest';
import { Dialog } from '../../../../../packages/app/src/renderer/components/Dialog/Dialog.js';
import { propsOf } from './_vnode.js';

interface DialogElementProps {
  readonly id: string;
  readonly class: string;
  readonly children: readonly unknown[];
}

describe('Dialog (V2-T62, D-051)', () => {
  it('renders a real <dialog> element with the given id', () => {
    const vnode = Dialog({ id: 'fallback-dialog', children: 'body' });
    const props = propsOf<DialogElementProps>(vnode);
    expect(vnode.type).toBe('dialog');
    expect(props.id).toBe('fallback-dialog');
    expect(props.class).toBe('seeya-dialog');
  });

  it('renders an h3 title only when one is given', () => {
    const withTitle = Dialog({ id: 'x', title: 'Hello' });
    const children = propsOf<DialogElementProps>(withTitle).children.filter(Boolean);
    expect((children[0] as { type: string }).type).toBe('h3');

    const withoutTitle = Dialog({ id: 'y' });
    const childrenWithout = propsOf<DialogElementProps>(withoutTitle).children.filter(Boolean);
    expect(childrenWithout).toHaveLength(0); // no title, no children — nothing truthy to render
  });

  it('appends className to the base seeya-dialog class', () => {
    const props = propsOf<DialogElementProps>(Dialog({ id: 'x', className: 'project-dialog' }));
    expect(props.class).toBe('seeya-dialog project-dialog');
  });
});
