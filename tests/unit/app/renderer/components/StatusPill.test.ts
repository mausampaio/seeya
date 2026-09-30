import { describe, expect, it } from 'vitest';
import { StatusPill } from '../../../../../packages/app/src/renderer/components/StatusPill/StatusPill.js';
import { propsOf } from './_vnode.js';

interface SpanProps {
  readonly class: string;
  readonly children: unknown;
}

describe('StatusPill (V2-T62, D-051)', () => {
  it('always renders its text — no colour-only variant exists', () => {
    const vnode = StatusPill({ tone: 'success', children: '3 running' });
    const props = propsOf<SpanProps>(vnode);
    expect(vnode.type).toBe('span');
    expect(props.children).toBe('3 running');
  });

  it('applies a class per tone', () => {
    for (const tone of ['success', 'info', 'warning', 'error', 'neutral'] as const) {
      expect(propsOf<SpanProps>(StatusPill({ tone, children: 'x' })).class).toBe(
        `seeya-status-pill seeya-status-pill--${tone}`,
      );
    }
  });
});
