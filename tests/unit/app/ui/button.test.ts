import { describe, expect, it } from 'vitest';
import { Button } from '../../../../packages/app/src/ui/button.js';
import { propsOf } from './_vnode.js';

interface ButtonElementProps {
  readonly type: string;
  readonly class: string;
  readonly children: unknown;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly hidden?: boolean;
  readonly onClick?: unknown;
  readonly 'aria-label'?: string;
}

describe('Button (V2-T62, D-051)', () => {
  it('renders a native button with the primary variant by default', () => {
    const vnode = Button({ children: 'Save' });
    const props = propsOf<ButtonElementProps>(vnode);
    expect(vnode.type).toBe('button');
    expect(props.type).toBe('button');
    expect(props.class).toBe('seeya-button seeya-button--primary');
    expect(props.children).toBe('Save');
  });

  it('applies the secondary/ghost variant class', () => {
    expect(propsOf<ButtonElementProps>(Button({ variant: 'secondary' })).class).toContain(
      'seeya-button--secondary',
    );
    expect(propsOf<ButtonElementProps>(Button({ variant: 'ghost' })).class).toContain(
      'seeya-button--ghost',
    );
  });

  it('forwards id, disabled, hidden and onClick', () => {
    const onClick = () => {};
    const vnode = Button({ id: 'end-day-button', disabled: true, hidden: true, onClick });
    const props = propsOf<ButtonElementProps>(vnode);
    expect(props.id).toBe('end-day-button');
    expect(props.disabled).toBe(true);
    expect(props.hidden).toBe(true);
    expect(props.onClick).toBe(onClick);
  });

  it('renders as type="submit" when asked', () => {
    expect(propsOf<ButtonElementProps>(Button({ type: 'submit' })).type).toBe('submit');
  });

  // D-024: the icon-only form carries its own aria-label through — TypeScript itself refuses to
  // compile `Button({ iconOnly: true })` without one (not asserted here, a compile-time guarantee).
  it('an icon-only button carries its aria-label onto the element', () => {
    const vnode = Button({ iconOnly: true, 'aria-label': 'Collapse sidebar', children: '‹' });
    const props = propsOf<ButtonElementProps>(vnode);
    expect(props['aria-label']).toBe('Collapse sidebar');
    expect(props.class).toContain('seeya-button--icon');
  });

  it('a non-icon-only button never sets aria-label', () => {
    expect(propsOf<ButtonElementProps>(Button({ children: 'Save' }))['aria-label']).toBeUndefined();
  });
});
