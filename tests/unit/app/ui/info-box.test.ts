import { describe, expect, it } from 'vitest';
import { InfoBox } from '../../../../packages/app/src/ui/info-box.js';
import { propsOf } from './_vnode.js';

interface DivProps {
  readonly class: string;
  readonly children: unknown;
}

describe('InfoBox (V2-T62, D-051)', () => {
  it('defaults to the neutral tone', () => {
    const vnode = InfoBox({ children: 'text' });
    const props = propsOf<DivProps>(vnode);
    expect(props.class).toBe('seeya-info-box seeya-info-box--neutral');
    expect(props.children).toBe('text');
  });

  it('applies a class per tone', () => {
    for (const tone of ['neutral', 'info', 'warning', 'error'] as const) {
      expect(propsOf<DivProps>(InfoBox({ tone, children: 'x' })).class).toBe(
        `seeya-info-box seeya-info-box--${tone}`,
      );
    }
  });
});
