/**
 * D-052 (V2-T75): joins CSS module class names, shared by every component in this directory so
 * none of them repeats the same lookup. `*.module.css` imports type as `Record<string, string |
 * undefined>` (`css-modules.d.ts`) because this project's own `noUncheckedIndexedAccess`
 * (`tsconfig.base.json`) makes ANY string-indexed lookup possibly-`undefined` — honestly: nothing
 * stops a `.tsx` file from naming a local class that got renamed or removed in its `.module.css`
 * sibling. `requiredClass` turns that "possibly missing" into a loud, named failure instead of a
 * silently-dropped class (AGENTS.md: the message names the value and the expected shape) — never
 * an `as string`/`!` that would just tell the compiler to stop checking what it already caught.
 *
 * @example
 * cx(styles, 'stack', direction === 'vertical' && 'vertical', props.wrap && 'wrap');
 */
export type ClassInput = string | false | undefined | null;

function requiredClass(classes: Record<string, string | undefined>, name: string): string {
  const value = classes[name];
  if (value === undefined) {
    throw new Error(
      `CSS module is missing the "${name}" class — add ".${name} { … }" to the .module.css ` +
        'file next to this component, or fix the name this component asks for.',
    );
  }
  return value;
}

export function cx(
  classes: Record<string, string | undefined>,
  ...names: readonly ClassInput[]
): string {
  return names
    .filter((name): name is string => typeof name === 'string')
    .map((name) => requiredClass(classes, name))
    .join(' ');
}

/**
 * Appends an EXTERNAL, caller-supplied class name (a parent's own `className` prop — not
 * necessarily one of this component's own local names) to a `cx(...)` result, never through
 * `requiredClass`'s lookup — that lookup only validates names this component's own `.module.css`
 * is supposed to define.
 *
 * @example
 * mergeClassName(cx(styles, 'button', 'primary'), props.className);
 */
export function mergeClassName(moduleClassName: string, externalClassName?: string): string {
  return [moduleClassName, externalClassName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
}
