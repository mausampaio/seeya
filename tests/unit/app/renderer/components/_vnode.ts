/**
 * V2-T62 (D-051): TypeScript types every JSX expression as `preact.VNode<any>` (`JSX.Element`),
 * so `.props` is unavoidably `any` at the type level, no matter what a component's own prop type
 * is — this is the ONE place that narrows it back to something a test can access safely, instead
 * of an ad hoc `as` scattered across every one of `packages/app/src/ui/`'s own test files
 * (AGENTS.md § "Nada de duplicação"). `_` prefix, same convention `tests/unit/core/_fixtures.ts`
 * and `tests/unit/application/_fakes.ts` already use for a test helper that isn't itself a test.
 *
 * @example
 * const props = propsOf<{ readonly class: string }>(Button({ children: 'Save' }));
 * expect(props.class).toBe('seeya-button seeya-button--primary');
 */
import type { VNode } from 'preact';

export function propsOf<T = Record<string, unknown>>(vnode: VNode<unknown>): T {
  // `vnode.props` for a `VNode<unknown>` is `{ children: ComponentChildren }` — never enough
  // overlap with an arbitrary `T` for a direct `as T`, so the cast goes through `unknown` first
  // (the same two-step TypeScript itself asks for whenever a cast "may be a mistake").
  return vnode.props as unknown as T;
}
