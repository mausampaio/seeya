import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { EmptyState } from '../../../../../packages/app/src/renderer/components/EmptyState/EmptyState.js';
import { propsOf } from './_vnode.js';

interface DivProps {
  readonly children: readonly unknown[];
}
interface ParagraphProps {
  readonly children: unknown;
}

describe('EmptyState (V2-T62, D-051)', () => {
  it('always renders the title', () => {
    const vnode = EmptyState({ title: 'Nothing to resume' });
    const children = propsOf<DivProps>(vnode).children.filter(Boolean);
    expect(children).toHaveLength(1);
    expect(propsOf<ParagraphProps>(children[0] as VNode<unknown>).children).toBe(
      'Nothing to resume',
    );
  });

  it('renders the description and action only when given', () => {
    const vnode = EmptyState({
      title: 'Nothing to resume',
      description: 'Every session is already open.',
      action: 'a button',
    });
    const children = propsOf<DivProps>(vnode).children.filter(Boolean);
    expect(children).toHaveLength(3);
  });
});
