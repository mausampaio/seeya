/**
 * D-052 (V2-T75): shared by every real-rendered component test in this directory. CSS module
 * class names are scoped/hashed at bundle time (`Icon.module.css`'s own `styles.foo` ===
 * `"Icon_foo"`, never the literal `"foo"`) — asserting against the STRING a test happens to guess
 * would be brittle for no reason; importing the SAME `.module.css` in the test and comparing
 * against ITS `styles.foo` is what stays correct regardless of the exact scoping scheme vitest's
 * own CSS-modules transform picks.
 */
export function classesOf(element: Element | null): readonly string[] {
  return (element?.className ?? '').split(' ').filter((part) => part.length > 0);
}
